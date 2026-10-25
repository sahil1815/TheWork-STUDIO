import { db } from "@/lib/db";
import { toDateString } from "@/lib/date-utils";
import { fromZonedTime, formatInTimeZone } from "date-fns-tz";
import { TaskStatus, TaskType, Role } from "@prisma/client";

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
      team: { select: { id: true, penaltiesEnabled: true } },
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
      : settings.teamTasksEnabled && (task.team ? task.team.penaltiesEnabled : true);

  if (isOverdue) {
    if (!isEnabled) {
      // Penalty system disabled for this task type or team; do not create
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
          team: { select: { id: true, penaltiesEnabled: true } },
          penalty: true,
        },
      });

      for (const task of teamTasks) {
        // If team has penalties disabled, skip
        if (task.team && task.team.penaltiesEnabled === false) {
          continue;
        }

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

/**
 * Evaluates overdue tasks belonging to a specific team and generates penalties
 * if penalties are enabled for that team.
 */
export async function evaluateAndSyncTeamPenalties(
  teamId: string,
  now: Date = new Date()
): Promise<void> {
  const team = await db.team.findUnique({
    where: { id: teamId },
    select: { id: true, penaltiesEnabled: true },
  });

  if (!team || !team.penaltiesEnabled) return;

  const teamTasks = await db.task.findMany({
    where: {
      teamId,
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

    const tz = responsibleUser.timeZone || "UTC";
    const deadline = getTaskDeadline(task, tz);

    if (now.getTime() > deadline.getTime()) {
      const { monthYear, year, month } = getPenaltyMonthDetails(deadline, tz);
      await db.taskPenalty.upsert({
        where: { taskId: task.id },
        create: {
          taskId: task.id,
          taskType: TaskType.TEAM,
          userId: responsibleUser.id,
          teamId,
          deadline,
          penaltyDate: now,
          monthYear,
          year,
          month,
        },
        update: {
          taskType: TaskType.TEAM,
          userId: responsibleUser.id,
          teamId,
          deadline,
          monthYear,
          year,
          month,
        },
      });
    }
  }
}

/**
 * Gets team-specific penalty data:
 * - Total penalty count (sum of all team members)
 * - Individual team member penalty counts
 * - Historical records and available months
 * - Permissions (canEdit true only for Master Admin and Admin)
 */
export async function getTeamPenaltyData(
  teamId: string,
  monthYear?: string,
  callerUserId?: string
) {
  const team = await db.team.findUnique({
    where: { id: teamId },
    include: {
      members: {
        include: {
          user: {
            select: { id: true, name: true, email: true, image: true, timeZone: true },
          },
        },
        orderBy: [{ role: "asc" }, { joinedAt: "asc" }],
      },
    },
  });

  if (!team) return null;

  const callerMember = callerUserId
    ? team.members.find((m) => m.userId === callerUserId)
    : undefined;

  const timeZone = callerMember?.user.timeZone || "UTC";
  const currentMonthYear = formatInTimeZone(new Date(), timeZone, "yyyy-MM");
  const selectedMonthYear = monthYear || currentMonthYear;

  // Retrieve penalties for this team in the selected month
  const penalties = await db.taskPenalty.findMany({
    where: {
      teamId,
      taskType: TaskType.TEAM,
      monthYear: selectedMonthYear,
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
          image: true,
        },
      },
    },
    orderBy: { deadline: "desc" },
  });

  // Calculate penalties for current month
  const currentMonthTotal = await db.taskPenalty.count({
    where: {
      teamId,
      taskType: TaskType.TEAM,
      monthYear: currentMonthYear,
    },
  });

  // Calculate member penalty counts for selected month
  const memberCounts = team.members.map((m) => {
    const memberPenalties = penalties.filter((p) => p.userId === m.userId);
    return {
      userId: m.userId,
      name: m.user.name || "Anonymous Member",
      email: m.user.email,
      image: m.user.image,
      role: m.role,
      penaltyCount: memberPenalties.length,
    };
  });

  // Available history months
  const distinctMonths = await db.taskPenalty.findMany({
    where: { teamId, taskType: TaskType.TEAM },
    select: { monthYear: true },
    distinct: ["monthYear"],
    orderBy: { monthYear: "desc" },
  });

  const availableMonthsSet = new Set(distinctMonths.map((m) => m.monthYear));
  availableMonthsSet.add(currentMonthYear);
  const availableMonths = Array.from(availableMonthsSet).sort().reverse();

  const isMasterAdmin = callerMember?.role === Role.OWNER;
  const isAdmin = callerMember?.role === Role.ADMIN || isMasterAdmin;

  return {
    teamId: team.id,
    teamName: team.name,
    penaltiesEnabled: team.penaltiesEnabled,
    currentMonthYear,
    selectedMonthYear,
    totalPenalties: penalties.length, // Included sum across all members
    currentMonthTotal,
    members: memberCounts, // Individual person counts
    penalties: penalties.map((p) => ({
      id: p.id,
      taskId: p.taskId,
      taskTitle: p.task.title,
      taskDate: toDateString(p.task.date),
      taskTiming: p.task.startTime || "All day",
      taskStatus: p.task.status,
      taskPriority: p.task.priority,
      deadline: p.deadline.toISOString(),
      penaltyDate: p.penaltyDate.toISOString(),
      monthYear: p.monthYear,
      responsibleUser: p.user,
    })),
    availableMonths,
    canEdit: isAdmin,
    currentUserRole: callerMember?.role,
  };
}
