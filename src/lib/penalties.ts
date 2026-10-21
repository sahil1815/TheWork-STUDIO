import { db } from "@/lib/db";
import { toDateString } from "@/lib/date-utils";
import { fromZonedTime, formatInTimeZone } from "date-fns-tz";
import { TaskStatus, TaskType } from "@prisma/client";

export interface TaskTimingData {
  date: Date | string;
  startTime?: string | null;
  endTime?: string | null;
}

/**
 * Calculates the exact UTC moment of a task's deadline.
 * - If endTime is provided: uses endTime on task's date.
 * - Else if startTime is provided: uses startTime on task's date.
 * - Else: all-day task, deadline is end of that date (23:59:59.999).
 */
export function getTaskDeadline(
  task: TaskTimingData,
  userTimeZone: string = "UTC"
): Date {
  const dateStr = toDateString(task.date);

  if (task.endTime && task.endTime.trim() !== "") {
    const localStr = `${dateStr}T${task.endTime.trim()}:00`;
    return fromZonedTime(localStr, userTimeZone);
  }

  if (task.startTime && task.startTime.trim() !== "") {
    const localStr = `${dateStr}T${task.startTime.trim()}:00`;
    return fromZonedTime(localStr, userTimeZone);
  }

  // All day task: end of day in user's timezone
  const localStr = `${dateStr}T23:59:59.999`;
  return fromZonedTime(localStr, userTimeZone);
}

/**
 * Checks if a task is overdue.
 */
export function isTaskOverdue(
  task: TaskTimingData & { status: TaskStatus },
  userTimeZone: string = "UTC",
  now: Date = new Date()
): boolean {
  if (task.status === TaskStatus.DONE || task.status === TaskStatus.CANCELLED) {
    return false;
  }
  const deadline = getTaskDeadline(task, userTimeZone);
  return now.getTime() > deadline.getTime();
}

/**
 * Formats a deadline into month-year references.
 */
export function getPenaltyMonthDetails(
  deadline: Date,
  userTimeZone: string = "UTC"
): { monthYear: string; year: number; month: number } {
  const monthYear = formatInTimeZone(deadline, userTimeZone, "yyyy-MM");
  const yearStr = formatInTimeZone(deadline, userTimeZone, "yyyy");
  const monthStr = formatInTimeZone(deadline, userTimeZone, "M");

  return {
    monthYear,
    year: parseInt(yearStr, 10),
    month: parseInt(monthStr, 10),
  };
}

/**
 * Gets or creates penalty settings for a user.
 */
export async function getOrCreatePenaltySettings(userId: string) {
  let settings = await db.penaltySetting.findUnique({
    where: { userId },
  });

  if (!settings) {
    settings = await db.penaltySetting.create({
      data: {
        userId,
        personalTasksEnabled: true,
        teamTasksEnabled: true,
      },
    });
  }

  return settings;
}

/**
 * Evaluates a single task and synchronizes its penalty record.
 */
export async function syncSingleTaskPenalty(
  taskId: string,
  now: Date = new Date()
): Promise<void> {
  const task = await db.task.findUnique({
    where: { id: taskId },
    include: {
      assignee: { select: { id: true, timeZone: true } },
      createdBy: { select: { id: true, timeZone: true } },
      penalty: true,
    },
  });

  if (!task) return;

  const responsibleUser = task.assignee || task.createdBy;
  if (!responsibleUser) return;

  const userTimeZone = responsibleUser.timeZone || "UTC";
  const deadline = getTaskDeadline(task, userTimeZone);
  const isOverdue =
    task.status !== TaskStatus.DONE &&
    task.status !== TaskStatus.CANCELLED &&
    now.getTime() > deadline.getTime();

  const taskType = task.teamId ? TaskType.TEAM : TaskType.PERSONAL;
  const settings = await getOrCreatePenaltySettings(responsibleUser.id);
  const isEnabled =
    taskType === TaskType.PERSONAL
      ? settings.personalTasksEnabled
      : settings.teamTasksEnabled;

  if (isOverdue) {
    if (!isEnabled) {
      // Penalty system disabled for this task type; do not create
      return;
    }

    const { monthYear, year, month } = getPenaltyMonthDetails(deadline, userTimeZone);

    await db.taskPenalty.upsert({
      where: { taskId: task.id },
      create: {
        taskId: task.id,
        taskType,
        userId: responsibleUser.id,
        teamId: task.teamId,
        deadline,
        penaltyDate: now,
        monthYear,
        year,
        month,
      },
      update: {
        taskType,
        userId: responsibleUser.id,
        teamId: task.teamId,
        deadline,
        monthYear,
        year,
        month,
      },
    });
  } else {
    // If not overdue:
    // If task deadline was rescheduled to the future, remove any active penalty
    if (now.getTime() <= deadline.getTime() && task.penalty) {
      await db.taskPenalty.delete({
        where: { taskId: task.id },
      }).catch(() => {});
    }
  }
}

/**
 * Evaluates all tasks for a user and their teams, creating or removing penalties.
 */
export async function evaluateAndSyncUserPenalties(
  userId: string,
  now: Date = new Date()
): Promise<void> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, timeZone: true },
  });

  if (!user) return;
  const userTimeZone = user.timeZone || "UTC";

  const settings = await getOrCreatePenaltySettings(userId);

  // 1. Evaluate Personal Tasks
  if (settings.personalTasksEnabled) {
    const personalTasks = await db.task.findMany({
      where: {
        teamId: null,
        OR: [{ assigneeId: userId }, { createdById: userId }],
        status: { notIn: [TaskStatus.DONE, TaskStatus.CANCELLED] },
      },
      include: { penalty: true },
    });

    for (const task of personalTasks) {
      const deadline = getTaskDeadline(task, userTimeZone);
      if (now.getTime() > deadline.getTime()) {
        const { monthYear, year, month } = getPenaltyMonthDetails(deadline, userTimeZone);
        await db.taskPenalty.upsert({
          where: { taskId: task.id },
          create: {
            taskId: task.id,
            taskType: TaskType.PERSONAL,
            userId,
            teamId: null,
            deadline,
            penaltyDate: now,
            monthYear,
            year,
            month,
          },
          update: {
            taskType: TaskType.PERSONAL,
            userId,
            teamId: null,
            deadline,
            monthYear,
            year,
            month,
          },
        });
      } else if (task.penalty) {
        // Rescheduled to future
        await db.taskPenalty.delete({ where: { taskId: task.id } }).catch(() => {});
      }
    }
  }

  // 2. Evaluate Team Tasks
  if (settings.teamTasksEnabled) {
    const userMemberships = await db.teamMember.findMany({
      where: { userId },
      select: { teamId: true },
    });
    const userTeamIds = userMemberships.map((m) => m.teamId);

    if (userTeamIds.length > 0) {
      const teamTasks = await db.task.findMany({
        where: {
          teamId: { in: userTeamIds },
          status: { notIn: [TaskStatus.DONE, TaskStatus.CANCELLED] },
        },
        include: {
          assignee: { select: { id: true, timeZone: true } },
          createdBy: { select: { id: true, timeZone: true } },
          penalty: true,
        },
      });

      for (const task of teamTasks) {
        const responsibleUser = task.assignee || task.createdBy;
        if (!responsibleUser) continue;

        const tz = responsibleUser.timeZone || userTimeZone;
        const deadline = getTaskDeadline(task, tz);

        if (now.getTime() > deadline.getTime()) {
          const { monthYear, year, month } = getPenaltyMonthDetails(deadline, tz);
          await db.taskPenalty.upsert({
            where: { taskId: task.id },
            create: {
              taskId: task.id,
              taskType: TaskType.TEAM,
              userId: responsibleUser.id,
              teamId: task.teamId,
              deadline,
              penaltyDate: now,
              monthYear,
              year,
              month,
            },
            update: {
              taskType: TaskType.TEAM,
              userId: responsibleUser.id,
              teamId: task.teamId,
              deadline,
              monthYear,
              year,
              month,
            },
          });
        } else if (task.penalty) {
          await db.taskPenalty.delete({ where: { taskId: task.id } }).catch(() => {});
        }
      }
    }
  }
}

/**
 * Gets monthly penalty counts and historical records.
 */
export async function getMonthlyPenaltySummary(
  userId: string,
  monthYear?: string,
  filterTeamId?: string
) {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, timeZone: true },
  });

  const userTimeZone = user?.timeZone || "UTC";
  const currentMonthYear = formatInTimeZone(new Date(), userTimeZone, "yyyy-MM");
  const selectedMonthYear = monthYear || currentMonthYear;

  const userMemberships = await db.teamMember.findMany({
    where: { userId },
    select: { teamId: true },
  });
  const userTeamIds = userMemberships.map((m) => m.teamId);

  // Current Month Counts
  const [currentPersonalCount, currentTeamCount] = await Promise.all([
    db.taskPenalty.count({
      where: {
        userId,
        taskType: TaskType.PERSONAL,
        monthYear: currentMonthYear,
      },
    }),
    db.taskPenalty.count({
      where: {
        taskType: TaskType.TEAM,
        monthYear: currentMonthYear,
        ...(filterTeamId
          ? { teamId: filterTeamId }
          : { OR: [{ userId }, { teamId: { in: userTeamIds } }] }),
      },
    }),
  ]);

  // Selected Month Penalties List
  const penalties = await db.taskPenalty.findMany({
    where: {
      monthYear: selectedMonthYear,
      OR: [
        { userId, taskType: TaskType.PERSONAL },
        {
          taskType: TaskType.TEAM,
          ...(filterTeamId
            ? { teamId: filterTeamId }
            : { OR: [{ userId }, { teamId: { in: userTeamIds } }] }),
        },
      ],
    },
    include: {
      task: {
        select: {
          id: true,
          title: true,
          date: true,
          startTime: true,
          endTime: true,
          status: true,
          priority: true,
        },
      },
      user: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      team: {
        select: {
          id: true,
          name: true,
        },
      },
    },
    orderBy: { deadline: "desc" },
  });

  // Calculate selected month counts
  const selectedPersonalPenalties = penalties.filter(
    (p) => p.taskType === TaskType.PERSONAL && p.userId === userId
  );
  const selectedTeamPenalties = penalties.filter(
    (p) => p.taskType === TaskType.TEAM
  );

  // Available history months (distinct monthYears from DB + current month)
  const distinctMonths = await db.taskPenalty.findMany({
    where: {
      OR: [
        { userId, taskType: TaskType.PERSONAL },
        { teamId: { in: userTeamIds }, taskType: TaskType.TEAM },
      ],
    },
    select: { monthYear: true },
    distinct: ["monthYear"],
    orderBy: { monthYear: "desc" },
  });

  const availableMonthsSet = new Set(distinctMonths.map((m) => m.monthYear));
  availableMonthsSet.add(currentMonthYear);
  const availableMonths = Array.from(availableMonthsSet).sort().reverse();

  return {
    currentMonthYear,
    selectedMonthYear,
    currentCounts: {
      personal: currentPersonalCount,
      team: currentTeamCount,
      total: currentPersonalCount + currentTeamCount,
    },
    selectedCounts: {
      personal: selectedPersonalPenalties.length,
      team: selectedTeamPenalties.length,
      total: penalties.length,
    },
    penalties: penalties.map((p) => ({
      id: p.id,
      taskId: p.taskId,
      taskType: p.taskType,
      taskTitle: p.task.title,
      taskDate: toDateString(p.task.date),
      taskTiming: p.task.startTime || "All day",
      taskStatus: p.task.status,
      taskPriority: p.task.priority,
      deadline: p.deadline.toISOString(),
      penaltyDate: p.penaltyDate.toISOString(),
      monthYear: p.monthYear,
      responsibleUser: p.user,
      team: p.team,
    })),
    availableMonths,
  };
}
