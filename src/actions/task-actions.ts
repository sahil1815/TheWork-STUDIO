"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { taskSchema, rescheduleTaskSchema, batchTasksSchema, TaskInput, BatchTasksInput, RescheduleTaskInput } from "@/lib/validations/task";
import { parseDateString, toDateString } from "@/lib/date-utils";
import { revalidatePath } from "next/cache";
import { Role, TaskStatus } from "@prisma/client";
import { can } from "@/lib/permissions";
import { syncTaskReminderJobs } from "@/lib/reminders";

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
async function canModifyTask(userId: string, task: { id: string; createdById: string; assigneeId: string | null; teamId: string | null }): Promise<boolean> {
  // If personal task: only creator or assignee can modify
  if (!task.teamId) {
    return task.createdById === userId || task.assigneeId === userId;
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
  // MEMBER can edit/delete only own tasks
  return task.createdById === userId || task.assigneeId === userId;
}

/**
 * Create a personal task (FR-03, FR-04, FR-05)
 */
export async function createPersonalTask(rawInput: TaskInput) {
  try {
    const userId = await getAuthUserId();
    const validated = taskSchema.parse(rawInput);

    const taskDate = parseDateString(validated.date);

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
        assigneeId: userId,
        teamId: validated.teamId || null,
      },
    });

    await syncTaskReminderJobs(task.id);

    revalidatePath("/calendar");
    revalidatePath("/tasks");
    return { success: true, task };
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
            assigneeId: userId,
            teamId: t.teamId || null,
          },
        });
        list.push(created);
      }
      return list;
    });

    for (const created of createdTasks) {
      await syncTaskReminderJobs(created.id);
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

    const existingTask = await db.task.findUnique({
      where: { id: taskId },
    });

    if (!existingTask) {
      return { success: false, error: "Task not found" };
    }

    const authorized = await canModifyTask(userId, existingTask);
    if (!authorized) {
      return { success: false, error: "You do not have permission to edit this task." };
    }

    const taskDate = parseDateString(validated.date);

    const updatedTask = await db.task.update({
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
      },
    });

    await syncTaskReminderJobs(updatedTask.id);

    revalidatePath("/calendar");
    revalidatePath("/tasks");
    return { success: true, task: updatedTask };
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
    });

    await syncTaskReminderJobs(task.id);

    revalidatePath("/calendar");
    revalidatePath("/tasks");
    return { success: true, task };
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

    const existingTask = await db.task.findUnique({
      where: { id: validated.taskId },
    });

    if (!existingTask) {
      return { success: false, error: "Task not found" };
    }

    const authorized = await canModifyTask(userId, existingTask);
    if (!authorized) {
      return { success: false, error: "Permission denied to reschedule task." };
    }

    const newDate = parseDateString(validated.date);

    const task = await db.task.update({
      where: { id: validated.taskId },
      data: {
        date: newDate,
        startTime: validated.startTime !== undefined ? validated.startTime : existingTask.startTime,
        endTime: validated.endTime !== undefined ? validated.endTime : existingTask.endTime,
      },
    });

    await syncTaskReminderJobs(task.id);

    revalidatePath("/calendar");
    revalidatePath("/tasks");
    return { success: true, task };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to reschedule task";
    return { success: false, error: message };
  }
}

/**
 * Fetch calendar tasks (FR-07, FR-08)
 * Filter: 'all' | 'personal' | teamId
 */
export async function getCalendarTasks(filter: string = "all") {
  try {
    const userId = await getAuthUserId();

    // Determine query conditions
    let whereCondition: any;

    if (filter === "personal") {
      whereCondition = {
        assigneeId: userId,
        teamId: null,
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
      const userMemberships = await db.teamMember.findMany({
        where: { userId },
        select: { teamId: true },
      });
      const userTeamIds = userMemberships.map((m) => m.teamId);

      whereCondition = {
        OR: [
          // Personal tasks
          { assigneeId: userId, teamId: null },
          // Team tasks in teams user belongs to
          { teamId: { in: userTeamIds } },
        ],
      };
    }

    const tasks = await db.task.findMany({
      where: whereCondition,
      include: {
        team: { select: { id: true, name: true } },
        assignee: { select: { id: true, name: true, email: true } },
        createdBy: { select: { id: true, name: true, email: true } },
      },
      orderBy: [{ date: "asc" }, { startTime: "asc" }],
    });

    // Format tasks for serialization
    return tasks.map((t) => ({
      ...t,
      dateString: toDateString(t.date),
    }));
  } catch (error) {
    console.error("Get calendar tasks error:", error);
    return [];
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
        team: { select: { id: true, name: true } },
      },
    });
    return memberships.map((m) => ({
      id: m.team.id,
      name: m.team.name,
      role: m.role,
    }));
  } catch {
    return [];
  }
}
