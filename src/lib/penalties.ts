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

  if (!task || task.penaltyWaived) return;

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
        penaltyWaived: false,
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
          penaltyWaived: false,
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
 * Helper to calculate start & end Date bounds for a given YYYY-MM string
 */
export function getMonthDateRange(monthYearStr: string) {
  const parts = monthYearStr.split("-");
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10);
  const start = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0));
  const end = new Date(Date.UTC(year, month, 1, 0, 0, 0));
  return { start, end };
}

/**
 * Gets monthly penalty counts, completion statistics, and historical records.
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

  const { start: currentMonthStart, end: currentMonthEnd } = getMonthDateRange(currentMonthYear);
  const { start: selectedMonthStart, end: selectedMonthEnd } = getMonthDateRange(selectedMonthYear);

  const userMemberships = await db.teamMember.findMany({
    where: { userId },
    select: { teamId: true },
  });
  const userTeamIds = userMemberships.map((m) => m.teamId);

  // Current Month Penalty Counts
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

  // Completed task counts: Current Month, Selected Month, and Lifetime
  const [
    currentPersonalCompleted,
    currentTeamCompleted,
    selectedPersonalCompleted,
    selectedTeamCompleted,
    lifetimePersonalCompleted,
    lifetimeTeamCompleted,
    completedTasks,
  ] = await Promise.all([
    // Current month completed personal
    db.task.count({
      where: {
        teamId: null,
        status: TaskStatus.DONE,
        date: { gte: currentMonthStart, lt: currentMonthEnd },
        OR: [
          { assigneeId: userId },
          { createdById: userId },
          { assignees: { some: { userId } } },
        ],
      },
    }),
    // Current month completed team (assigned to user)
    db.task.count({
      where: {
        teamId: filterTeamId ? filterTeamId : { in: userTeamIds, not: null },
        status: TaskStatus.DONE,
        date: { gte: currentMonthStart, lt: currentMonthEnd },
        OR: [
          { assigneeId: userId },
          { assignees: { some: { userId } } },
        ],
      },
    }),
    // Selected month completed personal
    db.task.count({
      where: {
        teamId: null,
        status: TaskStatus.DONE,
        date: { gte: selectedMonthStart, lt: selectedMonthEnd },
        OR: [
          { assigneeId: userId },
          { createdById: userId },
          { assignees: { some: { userId } } },
        ],
      },
    }),
    // Selected month completed team
    db.task.count({
      where: {
        teamId: filterTeamId ? filterTeamId : { in: userTeamIds, not: null },
        status: TaskStatus.DONE,
        date: { gte: selectedMonthStart, lt: selectedMonthEnd },
        OR: [
          { assigneeId: userId },
          { assignees: { some: { userId } } },
        ],
      },
    }),
    // Lifetime personal completed
    db.task.count({
      where: {
        teamId: null,
        status: TaskStatus.DONE,
        OR: [
          { assigneeId: userId },
          { createdById: userId },
          { assignees: { some: { userId } } },
        ],
      },
    }),
    // Lifetime team completed
    db.task.count({
      where: {
        teamId: filterTeamId ? filterTeamId : { in: userTeamIds, not: null },
        status: TaskStatus.DONE,
        OR: [
          { assigneeId: userId },
          { assignees: { some: { userId } } },
        ],
      },
    }),
    // Completed tasks for selected month inspection
    db.task.findMany({
      where: {
        status: TaskStatus.DONE,
        date: { gte: selectedMonthStart, lt: selectedMonthEnd },
        OR: [
          {
            teamId: null,
            OR: [
              { assigneeId: userId },
              { createdById: userId },
              { assignees: { some: { userId } } },
            ],
          },
          {
            teamId: filterTeamId ? filterTeamId : { in: userTeamIds, not: null },
            OR: [
              { assigneeId: userId },
              { assignees: { some: { userId } } },
            ],
          },
        ],
      },
      include: {
        team: { select: { id: true, name: true } },
        assignee: { select: { id: true, name: true, email: true } },
        assignees: {
          include: { user: { select: { id: true, name: true, email: true } } },
        },
      },
      orderBy: { date: "desc" },
      take: 50,
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

  const currentTotalCompleted = currentPersonalCompleted + currentTeamCompleted;
  const currentTotalPenalties = currentPersonalCount + currentTeamCount;
  const currentTotalEvaluated = currentTotalCompleted + currentTotalPenalties;
  const currentCompletionRate = currentTotalEvaluated > 0
    ? Math.round((currentTotalCompleted / currentTotalEvaluated) * 100)
    : 100;

  const selectedTotalCompleted = selectedPersonalCompleted + selectedTeamCompleted;
  const selectedTotalPenalties = penalties.length;
  const selectedTotalEvaluated = selectedTotalCompleted + selectedTotalPenalties;
  const selectedCompletionRate = selectedTotalEvaluated > 0
    ? Math.round((selectedTotalCompleted / selectedTotalEvaluated) * 100)
    : 100;

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
    completedCounts: {
      currentMonth: {
        personal: currentPersonalCompleted,
        team: currentTeamCompleted,
        total: currentTotalCompleted,
        completionRate: currentCompletionRate,
      },
      selectedMonth: {
        personal: selectedPersonalCompleted,
        team: selectedTeamCompleted,
        total: selectedTotalCompleted,
        completionRate: selectedCompletionRate,
      },
      lifetime: {
        personal: lifetimePersonalCompleted,
        team: lifetimeTeamCompleted,
        total: lifetimePersonalCompleted + lifetimeTeamCompleted,
      },
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
    completedTasks: completedTasks.map((t) => {
      const assigneesList =
        t.assignees && t.assignees.length > 0
          ? t.assignees.map((a: any) => a.user)
          : t.assignee
          ? [t.assignee]
          : [];
      return {
        id: t.id,
        title: t.title,
        taskType: t.teamId ? "TEAM" : "PERSONAL",
        date: toDateString(t.date),
        timing: t.startTime || "All day",
        status: t.status,
        priority: t.priority,
        team: t.team,
        assignee: t.assignee,
        assignees: assigneesList,
      };
    }),
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
      penaltyWaived: false,
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

  const { start: currentMonthStart, end: currentMonthEnd } = getMonthDateRange(currentMonthYear);
  const { start: selectedMonthStart, end: selectedMonthEnd } = getMonthDateRange(selectedMonthYear);

  // Retrieve team completed tasks in current month, selected month, and lifetime
  const [
    teamLifetimeCompleted,
    teamCurrentMonthCompleted,
    teamSelectedMonthCompleted,
    teamCompletedTasksSelectedMonth,
    teamLifetimeCompletedTasks,
  ] = await Promise.all([
    db.task.count({
      where: { teamId, status: TaskStatus.DONE },
    }),
    db.task.count({
      where: {
        teamId,
        status: TaskStatus.DONE,
        date: { gte: currentMonthStart, lt: currentMonthEnd },
      },
    }),
    db.task.count({
      where: {
        teamId,
        status: TaskStatus.DONE,
        date: { gte: selectedMonthStart, lt: selectedMonthEnd },
      },
    }),
    db.task.findMany({
      where: {
        teamId,
        status: TaskStatus.DONE,
        date: { gte: selectedMonthStart, lt: selectedMonthEnd },
      },
      include: {
        assignee: { select: { id: true, name: true, email: true, image: true } },
        assignees: {
          include: { user: { select: { id: true, name: true, email: true, image: true } } },
        },
      },
      orderBy: { date: "desc" },
    }),
    db.task.findMany({
      where: { teamId, status: TaskStatus.DONE },
      select: {
        assigneeId: true,
        assignees: { select: { userId: true } },
      },
    }),
  ]);

  // Calculate member penalty and completed counts for selected month and lifetime
  const memberCounts = team.members.map((m) => {
    const memberPenalties = penalties.filter((p) => p.userId === m.userId);
    const memberMonthCompleted = teamCompletedTasksSelectedMonth.filter(
      (t) =>
        t.assigneeId === m.userId ||
        t.assignees.some((a) => a.user?.id === m.userId || (a as any).userId === m.userId)
    ).length;
    const memberLifetimeCompleted = teamLifetimeCompletedTasks.filter(
      (t) => t.assigneeId === m.userId || t.assignees.some((a) => a.userId === m.userId)
    ).length;

    const totalHandledMonth = memberMonthCompleted + memberPenalties.length;
    const completionRate =
      totalHandledMonth > 0
        ? Math.round((memberMonthCompleted / totalHandledMonth) * 100)
        : memberMonthCompleted > 0
        ? 100
        : 100;

    return {
      userId: m.userId,
      name: m.user.name || "Anonymous Member",
      email: m.user.email,
      image: m.user.image,
      role: m.role,
      penaltyCount: memberPenalties.length,
      completedMonth: memberMonthCompleted,
      completedLifetime: memberLifetimeCompleted,
      completionRate,
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

  const totalHandledTeam = teamSelectedMonthCompleted + penalties.length;
  const teamCompletionRate =
    totalHandledTeam > 0
      ? Math.round((teamSelectedMonthCompleted / totalHandledTeam) * 100)
      : 100;

  return {
    teamId: team.id,
    teamName: team.name,
    penaltiesEnabled: team.penaltiesEnabled,
    currentMonthYear,
    selectedMonthYear,
    totalPenalties: penalties.length, // Included sum across all members
    currentMonthTotal,
    completedCounts: {
      currentMonth: teamCurrentMonthCompleted,
      selectedMonth: teamSelectedMonthCompleted,
      lifetime: teamLifetimeCompleted,
      completionRate: teamCompletionRate,
    },
    members: memberCounts, // Individual person counts & completion stats
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
    completedTasks: teamCompletedTasksSelectedMonth.map((t) => {
      const assigneesList =
        t.assignees && t.assignees.length > 0
          ? t.assignees.map((a: any) => a.user)
          : t.assignee
          ? [t.assignee]
          : [];
      return {
        id: t.id,
        title: t.title,
        date: toDateString(t.date),
        timing: t.startTime || "All day",
        status: t.status,
        priority: t.priority,
        assignee: t.assignee,
        assignees: assigneesList,
      };
    }),
    availableMonths,
    canEdit: isAdmin,
    currentUserRole: callerMember?.role,
  };
}
