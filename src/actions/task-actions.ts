"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  taskSchema,
  rescheduleTaskSchema,
  batchTasksSchema,
  convertPersonalTaskSchema,
  penaltySettingSchema,
  calendarViewSchema,
  CalendarViewMode,
  TaskInput,
  BatchTasksInput,
  RescheduleTaskInput,
  ConvertPersonalTaskInput,
} from "@/lib/validations/task";
import { parseDateString, toDateString } from "@/lib/date-utils";
import { revalidatePath } from "next/cache";
import { Role, TaskStatus, TaskType } from "@prisma/client";
import { can } from "@/lib/permissions";
import { syncTaskReminderJobs } from "@/lib/reminders";
import {
  syncSingleTaskPenalty,
  evaluateAndSyncUserPenalties,
  evaluateAndSyncTeamPenalties,
  getOrCreatePenaltySettings,
  getMonthlyPenaltySummary,
  getTeamPenaltyData,
} from "@/lib/penalties";
import { getUserMembership } from "@/actions/team-actions";

/**
 * Verify user is authenticated and return user id
 */
async function getAuthUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Unauthorized. Please sign in.");
  }
  return session.user.id;
}

/**
 * Helper to check if a user can edit/delete a given task
 */
async function canModifyTask(
  userId: string,
  task: {
    id: string;
    createdById: string;
    assigneeId: string | null;
    teamId: string | null;
    assignees?: { userId: string }[];
  }
): Promise<boolean> {
  const isAssignee =
    task.assigneeId === userId ||
    (task.assignees ? task.assignees.some((a) => a.userId === userId) : false);

  // If personal task: only creator or assignee can modify
  if (!task.teamId) {
    if (task.createdById === userId || isAssignee) return true;
    const directAssigned = await db.taskAssignee.findUnique({
      where: { taskId_userId: { taskId: task.id, userId } },
    });
    return !!directAssigned;
  }

  // If team task: check member role in team
  const membership = await db.teamMember.findUnique({
    where: {
      teamId_userId: {
        teamId: task.teamId,
        userId,
      },
    },
  });

  if (!membership) return false;
  if (membership.role === Role.GUEST) return false;
  if (membership.role === Role.OWNER || membership.role === Role.ADMIN) return true;
  // MEMBER can edit/delete only own tasks (created by them OR assigned to them)
  if (task.createdById === userId || isAssignee) return true;
  const directAssigned = await db.taskAssignee.findUnique({
    where: { taskId_userId: { taskId: task.id, userId } },
  });
  return !!directAssigned;
}

/**
 * Create a personal task (FR-03, FR-04, FR-05)
 */
export async function createPersonalTask(rawInput: TaskInput) {
  try {
    const userId = await getAuthUserId();
    const validated = taskSchema.parse(rawInput);

    const taskDate = parseDateString(validated.date);

    const targetAssigneeIds =
      validated.assigneeIds && validated.assigneeIds.length > 0
        ? Array.from(new Set(validated.assigneeIds.filter(Boolean)))
        : validated.assigneeId
        ? [validated.assigneeId]
        : [userId];
    const primaryAssigneeId = targetAssigneeIds[0] || userId;

    const task = await db.task.create({
      data: {
        title: validated.title.trim(),
        date: taskDate,
        startTime: validated.startTime && validated.startTime.trim() !== "" ? validated.startTime : null,
        endTime: validated.endTime && validated.endTime.trim() !== "" ? validated.endTime : null,
        description: validated.description?.trim() || null,
        status: validated.status,
        priority: validated.priority,
        location: validated.location?.trim() || null,
        color: validated.color || "#3b82f6",
        createdById: userId,
        assigneeId: primaryAssigneeId,
        teamId: validated.teamId || null,
        assignees: {
          create: targetAssigneeIds.map((uid) => ({ userId: uid })),
        },
      },
      include: {
        team: { select: { id: true, name: true } },
        assignee: { select: { id: true, name: true, email: true, image: true } },
        assignees: {
          include: {
            user: { select: { id: true, name: true, email: true, image: true } },
          },
        },
        createdBy: { select: { id: true, name: true, email: true, image: true } },
        penalty: true,
      },
    });

    const assigneesList =
      task.assignees && task.assignees.length > 0
        ? task.assignees.map((a: any) => a.user)
        : task.assignee
        ? [task.assignee]
        : [];

    await syncTaskReminderJobs(task.id);
    await syncSingleTaskPenalty(task.id);

    revalidatePath("/calendar");
    revalidatePath("/tasks");
    return {
      success: true,
      task: {
        ...task,
        dateString: toDateString(task.date),
        assignees: assigneesList,
      },
    };
  } catch (error: unknown) {
    console.error("Create task error:", error);
    const message = error instanceof Error ? error.message : "Failed to create task";
    return { success: false, error: message };
  }
}

/**
 * Create multiple tasks in batch (FR-03, FR-04, FR-05)
 * Tasks can be on the same date or different dates, personal or for teams.
 */
export async function createBatchTasks(rawInputs: TaskInput[]) {
  try {
    const userId = await getAuthUserId();
    if (!rawInputs || !Array.isArray(rawInputs) || rawInputs.length === 0) {
      return { success: false, error: "At least one task is required." };
    }

    const validatedTasks = rawInputs.map((input, index) => {
      const parsed = taskSchema.safeParse(input);
      if (!parsed.success) {
        const firstError = parsed.error.issues[0]?.message || "Invalid task data";
        throw new Error(`Task #${index + 1}: ${firstError}`);
      }
      return parsed.data;
    });

    // Check permissions if any tasks have teamId
    const teamTasks = validatedTasks.filter((t) => !!t.teamId);
    if (teamTasks.length > 0) {
      const uniqueTeamIds = Array.from(new Set(teamTasks.map((t) => t.teamId!)));
      const memberships = await db.teamMember.findMany({
        where: {
          userId,
          teamId: { in: uniqueTeamIds },
        },
      });
      const membershipMap = new Map(memberships.map((m) => [m.teamId, m.role]));

      for (let i = 0; i < validatedTasks.length; i++) {
        const t = validatedTasks[i];
        if (t.teamId) {
          const role = membershipMap.get(t.teamId);
          if (!role || !can(role, "CREATE_TEAM_TASK")) {
            throw new Error(`Task #${i + 1}: You do not have permission to create tasks in this team.`);
          }
        }
      }
    }

    const createdTasks = await db.$transaction(async (tx) => {
      const list = [];
      for (const t of validatedTasks) {
        const taskDate = parseDateString(t.date);
        const targetAssigneeIds =
          t.assigneeIds && t.assigneeIds.length > 0
            ? Array.from(new Set(t.assigneeIds.filter(Boolean)))
            : t.assigneeId
            ? [t.assigneeId]
            : [userId];
        const primaryAssigneeId = targetAssigneeIds[0] || userId;

        const created = await tx.task.create({
          data: {
            title: t.title.trim(),
            date: taskDate,
            startTime: t.startTime && t.startTime.trim() !== "" ? t.startTime : null,
            endTime: t.endTime && t.endTime.trim() !== "" ? t.endTime : null,
            description: t.description?.trim() || null,
            status: t.status,
            priority: t.priority,
            location: t.location?.trim() || null,
            color: t.color || "#3b82f6",
            createdById: userId,
            assigneeId: primaryAssigneeId,
            teamId: t.teamId || null,
            assignees: {
              create: targetAssigneeIds.map((uid) => ({ userId: uid })),
            },
          },
          include: {
            team: { select: { id: true, name: true } },
            assignee: { select: { id: true, name: true, email: true, image: true } },
            assignees: {
              include: {
                user: { select: { id: true, name: true, email: true, image: true } },
              },
            },
            createdBy: { select: { id: true, name: true, email: true, image: true } },
            penalty: true,
          },
        });

        const assigneesList =
          created.assignees && created.assignees.length > 0
            ? created.assignees.map((a: any) => a.user)
            : created.assignee
            ? [created.assignee]
            : [];

        list.push({
          ...created,
          dateString: toDateString(created.date),
          assignees: assigneesList,
        });
      }
      return list;
    });

    for (const created of createdTasks) {
      await syncTaskReminderJobs(created.id);
      await syncSingleTaskPenalty(created.id);
    }

    revalidatePath("/calendar");
    revalidatePath("/tasks");
    return { success: true, count: createdTasks.length, tasks: createdTasks };
  } catch (error: unknown) {
    console.error("Create batch tasks error:", error);
    const message = error instanceof Error ? error.message : "Failed to create tasks";
    return { success: false, error: message };
  }
}

/**
 * Update an existing task (FR-03, FR-04, FR-05)
 */
export async function updateTask(taskId: string, rawInput: TaskInput) {
  try {
    const userId = await getAuthUserId();
    const validated = taskSchema.parse(rawInput);

    // Sync any pending penalty for this task before evaluating
    await syncSingleTaskPenalty(taskId);

    const existingTask = await db.task.findUnique({
      where: { id: taskId },
      include: {
        team: { select: { id: true, name: true } },
        assignee: { select: { id: true, name: true, email: true } },
        createdBy: { select: { id: true, name: true, email: true } },
        penalty: true,
      },
    });

    if (!existingTask) {
      return { success: false, error: "Task not found" };
    }

    const authorized = await canModifyTask(userId, existingTask);
    if (!authorized) {
      return { success: false, error: "You do not have permission to edit this task." };
    }

    const taskDate = parseDateString(validated.date);
    const originalDateStr = toDateString(existingTask.date);
    const isDateChanged = originalDateStr !== validated.date;
    const hasPenalty = !!existingTask.penalty;

    const hasAssigneeUpdate =
      validated.assigneeIds !== undefined || validated.assigneeId !== undefined;
    let targetAssigneeIds: string[] = [];
    if (validated.assigneeIds !== undefined) {
      targetAssigneeIds = Array.from(new Set((validated.assigneeIds || []).filter(Boolean)));
    } else if (validated.assigneeId !== undefined) {
      targetAssigneeIds = validated.assigneeId ? [validated.assigneeId] : [];
    }

    if (hasPenalty && isDateChanged) {
      if (!hasAssigneeUpdate) {
        const existingAssignees = await db.taskAssignee.findMany({ where: { taskId } });
        targetAssigneeIds = existingAssignees.map((a) => a.userId);
        if (targetAssigneeIds.length === 0 && existingTask.assigneeId) {
          targetAssigneeIds = [existingTask.assigneeId];
        }
      }
      const primaryAssigneeId = targetAssigneeIds[0] || null;

      const newTask = await db.task.create({
        data: {
          title: validated.title.trim(),
          date: taskDate,
          startTime: validated.startTime && validated.startTime.trim() !== "" ? validated.startTime : null,
          endTime: validated.endTime && validated.endTime.trim() !== "" ? validated.endTime : null,
          description: validated.description?.trim() || null,
          status: TaskStatus.TODO,
          priority: validated.priority,
          location: validated.location?.trim() || null,
          color: validated.color || existingTask.color,
          teamId: existingTask.teamId,
          assigneeId: primaryAssigneeId,
          createdById: existingTask.createdById,
          recurrenceRule: existingTask.recurrenceRule,
          assignees: {
            create: targetAssigneeIds.map((uid) => ({ userId: uid })),
          },
        },
        include: {
          team: { select: { id: true, name: true } },
          assignee: { select: { id: true, name: true, email: true, image: true } },
          assignees: {
            include: {
              user: { select: { id: true, name: true, email: true, image: true } },
            },
          },
          createdBy: { select: { id: true, name: true, email: true, image: true } },
          penalty: true,
        },
      });

      const assigneesList =
        newTask.assignees && newTask.assignees.length > 0
          ? newTask.assignees.map((a: any) => a.user)
          : newTask.assignee
          ? [newTask.assignee]
          : [];

      await syncTaskReminderJobs(newTask.id);
      await syncSingleTaskPenalty(newTask.id);

      revalidatePath("/calendar");
      revalidatePath("/tasks");
      if (existingTask.teamId) {
        revalidatePath(`/teams/${existingTask.teamId}`);
      }

      return {
        success: true,
        task: {
          ...newTask,
          dateString: toDateString(newTask.date),
          assignees: assigneesList,
        },
        copied: true,
      };
    }

    const updatedTask = await db.$transaction(async (tx) => {
      if (hasAssigneeUpdate) {
        await tx.taskAssignee.deleteMany({ where: { taskId } });
        if (targetAssigneeIds.length > 0) {
          await tx.taskAssignee.createMany({
            data: targetAssigneeIds.map((uid) => ({ taskId, userId: uid })),
          });
        }
      }

      return await tx.task.update({
        where: { id: taskId },
        data: {
          title: validated.title.trim(),
          date: taskDate,
          startTime: validated.startTime && validated.startTime.trim() !== "" ? validated.startTime : null,
          endTime: validated.endTime && validated.endTime.trim() !== "" ? validated.endTime : null,
          description: validated.description?.trim() || null,
          status: validated.status,
          priority: validated.priority,
          location: validated.location?.trim() || null,
          color: validated.color || existingTask.color,
          ...(hasAssigneeUpdate && {
            assigneeId: targetAssigneeIds[0] || null,
          }),
        },
        include: {
          team: { select: { id: true, name: true } },
          assignee: { select: { id: true, name: true, email: true, image: true } },
          assignees: {
            include: {
              user: { select: { id: true, name: true, email: true, image: true } },
            },
          },
          createdBy: { select: { id: true, name: true, email: true, image: true } },
          penalty: true,
        },
      });
    });

    if (hasAssigneeUpdate && targetAssigneeIds[0] && targetAssigneeIds[0] !== existingTask.assigneeId) {
      await db.taskPenalty.updateMany({
        where: { taskId: updatedTask.id },
        data: { userId: targetAssigneeIds[0] },
      });
    }

    await syncTaskReminderJobs(updatedTask.id);
    await syncSingleTaskPenalty(updatedTask.id);

    revalidatePath("/calendar");
    revalidatePath("/tasks");
    if (updatedTask.teamId) {
      revalidatePath(`/teams/${updatedTask.teamId}`);
    }

    const assigneesList =
      updatedTask.assignees && updatedTask.assignees.length > 0
        ? updatedTask.assignees.map((a: any) => a.user)
        : updatedTask.assignee
        ? [updatedTask.assignee]
        : [];

    return {
      success: true,
      task: {
        ...updatedTask,
        dateString: toDateString(updatedTask.date),
        assignees: assigneesList,
      },
    };
  } catch (error: unknown) {
    console.error("Update task error:", error);
    const message = error instanceof Error ? error.message : "Failed to update task";
    return { success: false, error: message };
  }
}

/**
 * Toggle task completion (TODO <-> DONE)
 */
export async function toggleTaskComplete(taskId: string) {
  try {
    const userId = await getAuthUserId();

    const existingTask = await db.task.findUnique({
      where: { id: taskId },
    });

    if (!existingTask) {
      return { success: false, error: "Task not found" };
    }

    const authorized = await canModifyTask(userId, existingTask);
    if (!authorized) {
      return { success: false, error: "Permission denied." };
    }

    const newStatus = existingTask.status === TaskStatus.DONE ? TaskStatus.TODO : TaskStatus.DONE;

    const task = await db.task.update({
      where: { id: taskId },
      data: { status: newStatus },
      include: {
        team: { select: { id: true, name: true } },
        assignee: { select: { id: true, name: true, email: true, image: true } },
        assignees: {
          include: {
            user: { select: { id: true, name: true, email: true, image: true } },
          },
        },
        createdBy: { select: { id: true, name: true, email: true, image: true } },
        penalty: true,
      },
    });

    await syncTaskReminderJobs(task.id);
    await syncSingleTaskPenalty(task.id);

    revalidatePath("/calendar");
    revalidatePath("/tasks");
    const assigneesList =
      task.assignees && task.assignees.length > 0
        ? task.assignees.map((a: any) => a.user)
        : task.assignee
        ? [task.assignee]
        : [];

    return {
      success: true,
      task: {
        ...task,
        dateString: toDateString(task.date),
        assignees: assigneesList,
      },
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to toggle task";
    return { success: false, error: message };
  }
}

/**
 * Delete a task (FR-03)
 */
export async function deleteTask(taskId: string) {
  try {
    const userId = await getAuthUserId();

    const existingTask = await db.task.findUnique({
      where: { id: taskId },
    });

    if (!existingTask) {
      return { success: false, error: "Task not found" };
    }

    const authorized = await canModifyTask(userId, existingTask);
    if (!authorized) {
      return { success: false, error: "Permission denied to delete this task." };
    }

    await db.task.delete({
      where: { id: taskId },
    });

    revalidatePath("/calendar");
    revalidatePath("/tasks");
    return { success: true };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to delete task";
    return { success: false, error: message };
  }
}

/**
 * Drag to reschedule task (FR-09)
 */
export async function rescheduleTask(rawInput: RescheduleTaskInput) {
  try {
    const userId = await getAuthUserId();
    const validated = rescheduleTaskSchema.parse(rawInput);

    // Sync any pending penalty for this task before evaluating
    await syncSingleTaskPenalty(validated.taskId);

    const existingTask = await db.task.findUnique({
      where: { id: validated.taskId },
      include: {
        team: { select: { id: true, name: true } },
        assignee: { select: { id: true, name: true, email: true } },
        createdBy: { select: { id: true, name: true, email: true } },
        penalty: true,
      },
    });

    if (!existingTask) {
      return { success: false, error: "Task not found" };
    }

    const authorized = await canModifyTask(userId, existingTask);
    if (!authorized) {
      return { success: false, error: "Permission denied to reschedule task." };
    }

    const newDate = parseDateString(validated.date);
    const originalDateStr = toDateString(existingTask.date);
    const isDateChanged = originalDateStr !== validated.date;
    const hasPenalty = !!existingTask.penalty;

    if (hasPenalty && isDateChanged) {
      // The task already got a penalty and user changed the date:
      // The undone task still shows on the original date with its penalty intact.
      // A new copy of the same task appears on the new date.
      const existingAssignees = await db.taskAssignee.findMany({
        where: { taskId: existingTask.id },
      });
      const targetAssigneeIds =
        existingAssignees.length > 0
          ? existingAssignees.map((a) => a.userId)
          : existingTask.assigneeId
          ? [existingTask.assigneeId]
          : [];

      const newTask = await db.task.create({
        data: {
          title: existingTask.title,
          date: newDate,
          startTime: validated.startTime !== undefined ? validated.startTime : existingTask.startTime,
          endTime: validated.endTime !== undefined ? validated.endTime : existingTask.endTime,
          description: existingTask.description,
          status: TaskStatus.TODO,
          priority: existingTask.priority,
          location: existingTask.location,
          color: existingTask.color,
          teamId: existingTask.teamId,
          assigneeId: existingTask.assigneeId,
          createdById: existingTask.createdById,
          recurrenceRule: existingTask.recurrenceRule,
          assignees: {
            create: targetAssigneeIds.map((uid) => ({ userId: uid })),
          },
        },
        include: {
          team: { select: { id: true, name: true } },
          assignee: { select: { id: true, name: true, email: true, image: true } },
          assignees: {
            include: {
              user: { select: { id: true, name: true, email: true, image: true } },
            },
          },
          createdBy: { select: { id: true, name: true, email: true, image: true } },
          penalty: true,
        },
      });

      const assigneesList =
        newTask.assignees && newTask.assignees.length > 0
          ? newTask.assignees.map((a: any) => a.user)
          : newTask.assignee
          ? [newTask.assignee]
          : [];

      await syncTaskReminderJobs(newTask.id);
      await syncSingleTaskPenalty(newTask.id);

      revalidatePath("/calendar");
      revalidatePath("/tasks");
      if (existingTask.teamId) {
        revalidatePath(`/teams/${existingTask.teamId}`);
      }

      return {
        success: true,
        task: {
          ...newTask,
          dateString: toDateString(newTask.date),
          assignees: assigneesList,
        },
        copied: true,
      };
    }

    const task = await db.task.update({
      where: { id: validated.taskId },
      data: {
        date: newDate,
        startTime: validated.startTime !== undefined ? validated.startTime : existingTask.startTime,
        endTime: validated.endTime !== undefined ? validated.endTime : existingTask.endTime,
      },
      include: {
        team: { select: { id: true, name: true } },
        assignee: { select: { id: true, name: true, email: true, image: true } },
        assignees: {
          include: {
            user: { select: { id: true, name: true, email: true, image: true } },
          },
        },
        createdBy: { select: { id: true, name: true, email: true, image: true } },
        penalty: true,
      },
    });

    await syncTaskReminderJobs(task.id);
    await syncSingleTaskPenalty(task.id);

    revalidatePath("/calendar");
    revalidatePath("/tasks");
    if (task.teamId) {
      revalidatePath(`/teams/${task.teamId}`);
    }

    const assigneesList =
      task.assignees && task.assignees.length > 0
        ? task.assignees.map((a: any) => a.user)
        : task.assignee
        ? [task.assignee]
        : [];

    return {
      success: true,
      task: {
        ...task,
        dateString: toDateString(task.date),
        assignees: assigneesList,
      },
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to reschedule task";
    return { success: false, error: message };
  }
}

/**
 * Fetch calendar tasks (FR-07, FR-08)
 * Filter: 'all' | 'all-assigned-to-me' | 'personal' | 'team' | 'team-assigned-to-me' | 'team-assigned-to-others' | teamId
 */
export async function getCalendarTasks(filter: string = "all") {
  try {
    const userId = await getAuthUserId();

    // Ensure penalties are evaluated up-to-date
    await evaluateAndSyncUserPenalties(userId);

    const userMemberships = await db.teamMember.findMany({
      where: { userId },
      select: { teamId: true },
    });
    const userTeamIds = userMemberships.map((m) => m.teamId);

    // Determine query conditions
    let whereCondition: any;

    if (filter === "personal") {
      // Personal tasks: teamId must be null
      whereCondition = {
        teamId: null,
        OR: [
          { assigneeId: userId },
          { createdById: userId },
          { assignees: { some: { userId } } },
        ],
      };
    } else if (
      filter === "all-assigned-to-me" ||
      filter === "assigned-to-me" ||
      filter === "all-me" ||
      filter === "me"
    ) {
      // All tasks assigned to current user (both personal tasks and team tasks)
      whereCondition = {
        OR: [
          // Personal tasks
          { teamId: null, assigneeId: userId },
          { teamId: null, createdById: userId },
          { teamId: null, assignees: { some: { userId } } },
          // Team tasks assigned to current user in teams user belongs to
          { teamId: { in: userTeamIds, not: null }, assigneeId: userId },
          { teamId: { in: userTeamIds, not: null }, assignees: { some: { userId } } },
        ],
      };
    } else if (filter === "team" || filter === "teams") {
      // Team tasks: only tasks with teamId in user's teams, strictly team tasks
      whereCondition = {
        teamId: { in: userTeamIds, not: null },
      };
    } else if (filter === "team-assigned-to-me" || filter === "team-me") {
      // Team tasks assigned to current user
      whereCondition = {
        teamId: { in: userTeamIds, not: null },
        OR: [
          { assigneeId: userId },
          { assignees: { some: { userId } } },
        ],
      };
    } else if (filter === "team-assigned-to-others" || filter === "team-others") {
      // Team tasks assigned to others (not current user)
      whereCondition = {
        teamId: { in: userTeamIds, not: null },
        AND: [
          { OR: [{ assigneeId: { not: userId } }, { assigneeId: null }] },
          { assignees: { none: { userId } } },
        ],
      };
    } else if (filter.endsWith(":me") || filter.endsWith("-me")) {
      const targetTeamId = filter.replace(/:me$|-me$/, "");
      const membership = await db.teamMember.findUnique({
        where: { teamId_userId: { teamId: targetTeamId, userId } },
      });
      if (!membership) return [];

      whereCondition = {
        teamId: targetTeamId,
        OR: [
          { assigneeId: userId },
          { assignees: { some: { userId } } },
        ],
      };
    } else if (filter.endsWith(":others") || filter.endsWith("-others")) {
      const targetTeamId = filter.replace(/:others$|-others$/, "");
      const membership = await db.teamMember.findUnique({
        where: { teamId_userId: { teamId: targetTeamId, userId } },
      });
      if (!membership) return [];

      whereCondition = {
        teamId: targetTeamId,
        AND: [
          { OR: [{ assigneeId: { not: userId } }, { assigneeId: null }] },
          { assignees: { none: { userId } } },
        ],
      };
    } else if (filter !== "all") {
      // Specific team filter: ensure user is member of this team
      const membership = await db.teamMember.findUnique({
        where: { teamId_userId: { teamId: filter, userId } },
      });
      if (!membership) return [];

      whereCondition = {
        teamId: filter,
      };
    } else {
      // 'all': personal tasks for user OR team tasks for teams user belongs to
      whereCondition = {
        OR: [
          // Personal tasks
          { teamId: null, assigneeId: userId },
          { teamId: null, createdById: userId },
          { teamId: null, assignees: { some: { userId } } },
          // Team tasks in teams user belongs to
          { teamId: { in: userTeamIds, not: null } },
        ],
      };
    }

    const tasks = await db.task.findMany({
      where: whereCondition,
      include: {
        team: { select: { id: true, name: true } },
        assignee: { select: { id: true, name: true, email: true, image: true } },
        assignees: {
          include: {
            user: { select: { id: true, name: true, email: true, image: true } },
          },
        },
        createdBy: { select: { id: true, name: true, email: true, image: true } },
        penalty: true,
      },
      orderBy: [{ date: "asc" }, { startTime: "asc" }],
    });

    // Format tasks for serialization
    return tasks.map((t) => {
      const assigneesList =
        t.assignees && t.assignees.length > 0
          ? t.assignees.map((a: any) => a.user)
          : t.assignee
          ? [t.assignee]
          : [];

      return {
        ...t,
        dateString: toDateString(t.date),
        assignees: assigneesList,
      };
    });
  } catch (error) {
    console.error("Get calendar tasks error:", error);
    return [];
  }
}

/**
 * Convert an existing personal task into a team task
 */
export async function convertPersonalTaskToTeamTask(
  taskId: string,
  rawInput: { teamId: string; assigneeId?: string | null; assigneeIds?: string[] | null }
) {
  try {
    const userId = await getAuthUserId();
    const validated = convertPersonalTaskSchema.parse({
      taskId,
      ...rawInput,
    });

    const existingTask = await db.task.findUnique({
      where: { id: taskId },
      include: { penalty: true },
    });

    if (!existingTask) {
      return { success: false, error: "Task not found." };
    }

    if (existingTask.teamId !== null) {
      return { success: false, error: "Task is already a team task." };
    }

    const authorized = await canModifyTask(userId, existingTask);
    if (!authorized) {
      return { success: false, error: "You do not have permission to modify this task." };
    }

    // Verify user membership in destination team
    const membership = await db.teamMember.findUnique({
      where: {
        teamId_userId: {
          teamId: validated.teamId,
          userId,
        },
      },
    });

    if (!membership) {
      return { success: false, error: "You are not a member of the selected team." };
    }

    if (!can(membership.role, "CREATE_TEAM_TASK")) {
      return {
        success: false,
        error: "Guests cannot create or convert tasks in this team.",
      };
    }

    // Determine target assignees
    let targetAssigneeIds: string[] = [];
    if (validated.assigneeIds && validated.assigneeIds.length > 0) {
      targetAssigneeIds = Array.from(new Set(validated.assigneeIds.filter(Boolean)));
    } else if (validated.assigneeId && validated.assigneeId.trim() !== "") {
      targetAssigneeIds = [validated.assigneeId];
    } else {
      targetAssigneeIds = [userId];
    }

    // Verify all target assignees are members of this team
    for (const memberId of targetAssigneeIds) {
      const targetMembership = await db.teamMember.findUnique({
        where: {
          teamId_userId: {
            teamId: validated.teamId,
            userId: memberId,
          },
        },
      });
      if (!targetMembership) {
        return { success: false, error: "One or more selected assignees are not members of this team." };
      }
    }

    const primaryAssigneeId = targetAssigneeIds[0] || userId;

    // Update the task to team task and assignees
    const updatedTask = await db.$transaction(async (tx) => {
      await tx.taskAssignee.deleteMany({ where: { taskId } });
      await tx.taskAssignee.createMany({
        data: targetAssigneeIds.map((uid) => ({ taskId, userId: uid })),
      });

      return await tx.task.update({
        where: { id: taskId },
        data: {
          teamId: validated.teamId,
          assigneeId: primaryAssigneeId,
        },
        include: {
          team: { select: { id: true, name: true } },
          assignee: { select: { id: true, name: true, email: true, image: true } },
          assignees: {
            include: {
              user: { select: { id: true, name: true, email: true, image: true } },
            },
          },
          createdBy: { select: { id: true, name: true, email: true, image: true } },
          penalty: true,
        },
      });
    });

    // If task had a penalty, update it to reflect team task classification & assignee
    if (existingTask.penalty) {
      await db.taskPenalty.update({
        where: { taskId: existingTask.id },
        data: {
          taskType: TaskType.TEAM,
          teamId: validated.teamId,
          userId: primaryAssigneeId,
        },
      });
    }

    // Sync reminders & penalty
    await syncTaskReminderJobs(updatedTask.id);
    await syncSingleTaskPenalty(updatedTask.id);

    revalidatePath("/calendar");
    revalidatePath("/tasks");
    revalidatePath(`/teams/${validated.teamId}`);

    const assigneesList =
      updatedTask.assignees && updatedTask.assignees.length > 0
        ? updatedTask.assignees.map((a: any) => a.user)
        : updatedTask.assignee
        ? [updatedTask.assignee]
        : [];

    return {
      success: true,
      task: {
        ...updatedTask,
        dateString: toDateString(updatedTask.date),
        assignees: assigneesList,
      },
    };
  } catch (error: unknown) {
    console.error("Convert task error:", error);
    const message = error instanceof Error ? error.message : "Failed to convert task";
    return { success: false, error: message };
  }
}

/**
 * Get members of a specific team (for assigning converted team tasks)
 */
export async function getTeamMembers(teamId: string) {
  try {
    const userId = await getAuthUserId();
    const membership = await db.teamMember.findUnique({
      where: {
        teamId_userId: { teamId, userId },
      },
    });

    if (!membership) return [];

    const members = await db.teamMember.findMany({
      where: { teamId },
      include: {
        user: { select: { id: true, name: true, email: true, image: true } },
      },
      orderBy: [{ role: "asc" }, { joinedAt: "asc" }],
    });

    return members.map((m) => ({
      id: m.user.id,
      name: m.user.name,
      email: m.user.email,
      role: m.role,
    }));
  } catch (error) {
    console.error("Get team members error:", error);
    return [];
  }
}

/**
 * Get penalty settings for current user
 */
export async function getPenaltySettingsAction() {
  try {
    const userId = await getAuthUserId();
    const settings = await getOrCreatePenaltySettings(userId);
    const adminMembership = await db.teamMember.findFirst({
      where: {
        userId,
        role: { in: [Role.OWNER, Role.ADMIN] },
      },
    });
    return {
      success: true,
      settings,
      canEditTeamPenalties: !!adminMembership,
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to load penalty settings";
    return { success: false, error: message };
  }
}

/**
 * Update independent penalty toggles for personal or team tasks
 * (Team task penalties can only be edited by Master Admin or Admin)
 */
export async function updatePenaltySettingsAction(rawInput: {
  personalTasksEnabled?: boolean;
  teamTasksEnabled?: boolean;
}) {
  try {
    const userId = await getAuthUserId();
    const validated = penaltySettingSchema.parse(rawInput);

    if (validated.teamTasksEnabled !== undefined) {
      const adminRole = await db.teamMember.findFirst({
        where: {
          userId,
          role: { in: [Role.OWNER, Role.ADMIN] },
        },
      });

      if (!adminRole) {
        return {
          success: false,
          error: "A team task penalty should only be editable by the master admin and the admin.",
        };
      }
    }

    const settings = await db.penaltySetting.upsert({
      where: { userId },
      create: {
        userId,
        personalTasksEnabled: validated.personalTasksEnabled ?? true,
        teamTasksEnabled: validated.teamTasksEnabled ?? true,
      },
      update: {
        ...(validated.personalTasksEnabled !== undefined && {
          personalTasksEnabled: validated.personalTasksEnabled,
        }),
        ...(validated.teamTasksEnabled !== undefined && {
          teamTasksEnabled: validated.teamTasksEnabled,
        }),
      },
    });

    // Re-evaluate penalties after setting change
    await evaluateAndSyncUserPenalties(userId);

    revalidatePath("/tasks");
    revalidatePath("/calendar");

    return { success: true, settings };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to update penalty settings";
    return { success: false, error: message };
  }
}

/**
 * Get monthly penalty counts and history records
 */
export async function getPenaltySummaryAction(monthYear?: string, teamId?: string) {
  try {
    const userId = await getAuthUserId();
    await evaluateAndSyncUserPenalties(userId);
    const summary = await getMonthlyPenaltySummary(userId, monthYear, teamId);
    return { success: true, summary };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to load penalty summary";
    return { success: false, error: message };
  }
}

/**
 * Get teams for the current user (for calendar & task filtering)
 */
export async function getUserTeams() {
  try {
    const userId = await getAuthUserId();
    const memberships = await db.teamMember.findMany({
      where: { userId },
      include: {
        team: {
          select: {
            id: true,
            name: true,
            members: {
              include: {
                user: {
                  select: { id: true, name: true, email: true },
                },
              },
            },
          },
        },
      },
    });
    return memberships.map((m) => ({
      id: m.team.id,
      name: m.team.name,
      role: m.role,
      members: m.team.members.map((tm) => ({
        id: tm.id,
        userId: tm.userId,
        role: tm.role,
        user: tm.user,
      })),
    }));
  } catch {
    return [];
  }
}

/**
 * Get team penalty summary: total count and individual team member counts
 */
export async function getTeamPenaltySummaryAction(teamId: string, monthYear?: string) {
  try {
    const userId = await getAuthUserId();
    const membership = await getUserMembership(teamId, userId);
    if (!membership || !can(membership.role, "VIEW_TEAM")) {
      return { success: false, error: "Unauthorized: not a member of this team" };
    }

    await evaluateAndSyncTeamPenalties(teamId);
    const data = await getTeamPenaltyData(teamId, monthYear, userId);
    return { success: true, data };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to load team penalties";
    return { success: false, error: message };
  }
}

/**
 * Toggle team penalty system on/off for a team
 * (Only Master Admin and Admin can perform this action)
 */
export async function toggleTeamPenaltiesAction(teamId: string, enabled: boolean) {
  try {
    const userId = await getAuthUserId();
    const membership = await getUserMembership(teamId, userId);
    if (!membership || !can(membership.role, "MANAGE_TEAM_PENALTIES")) {
      return {
        success: false,
        error: "A team task penalty should only be editable by the master admin and the admin.",
      };
    }

    await db.team.update({
      where: { id: teamId },
      data: { penaltiesEnabled: enabled },
    });

    if (enabled) {
      await evaluateAndSyncTeamPenalties(teamId);
    }

    revalidatePath(`/teams/${teamId}`);
    revalidatePath("/tasks");
    revalidatePath("/calendar");

    return { success: true, penaltiesEnabled: enabled };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to update team penalties";
    return { success: false, error: message };
  }
}

/**
 * Remove an existing penalty record (for personal or team tasks)
 * - For personal tasks: the task owner/assignee can remove their penalty
 * - For team tasks: Master Admin and Admin can remove the penalty
 */
export async function removePenaltyAction(penaltyIdOrTaskId: string) {
  try {
    const userId = await getAuthUserId();

    const penalty = await db.taskPenalty.findFirst({
      where: {
        OR: [
          { id: penaltyIdOrTaskId },
          { taskId: penaltyIdOrTaskId },
        ],
      },
      include: {
        task: true,
      },
    });

    if (!penalty) {
      return { success: false, error: "Penalty record not found." };
    }

    if (penalty.taskType === TaskType.PERSONAL) {
      if (penalty.userId !== userId && penalty.task?.createdById !== userId) {
        return { success: false, error: "You do not have permission to remove this penalty." };
      }
    } else {
      if (penalty.teamId) {
        const membership = await getUserMembership(penalty.teamId, userId);
        if (!membership || !can(membership.role, "MANAGE_TEAM_PENALTIES")) {
          return {
            success: false,
            error: "A team task penalty should only be editable by the master admin and the admin.",
          };
        }
      }
    }

    if (penalty.taskId) {
      await db.task.update({
        where: { id: penalty.taskId },
        data: {
          penaltyWaived: true,
          ...(penalty.task?.status === TaskStatus.TODO && {
            status: TaskStatus.DONE,
          }),
        },
      });
    }

    await db.taskPenalty.delete({
      where: { id: penalty.id },
    });

    revalidatePath("/tasks");
    revalidatePath("/calendar");
    if (penalty.teamId) {
      revalidatePath(`/teams/${penalty.teamId}`);
    }

    return { success: true };
  } catch (error: unknown) {
    console.error("Remove penalty error:", error);
    const message = error instanceof Error ? error.message : "Failed to remove penalty";
    return { success: false, error: message };
  }
}

/**
 * Waive / delete an existing team task penalty record
 * (Only Master Admin and Admin can perform this action)
 */
export async function waiveTeamTaskPenaltyAction(teamId: string, penaltyId: string) {
  try {
    const userId = await getAuthUserId();
    const membership = await getUserMembership(teamId, userId);
    if (!membership || !can(membership.role, "MANAGE_TEAM_PENALTIES")) {
      return {
        success: false,
        error: "A team task penalty should only be editable by the master admin and the admin.",
      };
    }

    const penalty = await db.taskPenalty.findUnique({
      where: { id: penaltyId },
      include: { task: true },
    });

    if (!penalty || penalty.teamId !== teamId) {
      return { success: false, error: "Penalty not found in this team." };
    }

    if (penalty.taskId) {
      await db.task.update({
        where: { id: penalty.taskId },
        data: {
          penaltyWaived: true,
          ...(penalty.task?.status === TaskStatus.TODO && {
            status: TaskStatus.DONE,
          }),
        },
      });
    }

    await db.taskPenalty.delete({
      where: { id: penaltyId },
    });

    revalidatePath(`/teams/${teamId}`);
    revalidatePath("/tasks");
    revalidatePath("/calendar");

    return { success: true };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to waive penalty";
    return { success: false, error: message };
  }
}

/**
 * Update the user's default calendar view mode (month, week, day, agenda)
 */
export async function updateDefaultCalendarView(view: CalendarViewMode) {
  try {
    const userId = await getAuthUserId();
    const validatedView = calendarViewSchema.parse(view);

    const user = await db.user.update({
      where: { id: userId },
      data: { defaultCalendarView: validatedView },
      select: { id: true, defaultCalendarView: true },
    });

    revalidatePath("/calendar");
    revalidatePath("/settings/account");

    return { success: true, defaultCalendarView: user.defaultCalendarView as CalendarViewMode };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to update default calendar view";
    return { success: false, error: message };
  }
}

/**
 * Get the current user's default calendar view mode
 */
export async function getDefaultCalendarView(): Promise<CalendarViewMode> {
  try {
    const userId = await getAuthUserId();
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { defaultCalendarView: true },
    });
    if (user?.defaultCalendarView && ["month", "week", "day", "agenda"].includes(user.defaultCalendarView)) {
      return user.defaultCalendarView as CalendarViewMode;
    }
    return "month";
  } catch {
    return "month";
  }
}
