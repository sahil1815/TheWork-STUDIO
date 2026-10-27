import { db } from "@/lib/db";
import { toDateString } from "@/lib/date-utils";
import { fromZonedTime } from "date-fns-tz";
import { ReminderJobStatus, TaskStatus } from "@prisma/client";

/**
 * Default reminder offsets (FR-25):
 * - 4320 min: 3 days before
 * - 1440 min: 1 day before
 * - 0 min: Day of task (at start time or 00:00 for all-day)
 */
export const DEFAULT_REMINDER_OFFSETS = [4320, 1440, 0];

/**
 * Format minutes into a user-friendly label
 */
export function formatOffsetLabel(offsetMinutes: number): string {
  if (offsetMinutes === 4320) return "3 days before";
  if (offsetMinutes === 1440) return "1 day before";
  if (offsetMinutes === 0) return "Day of task (at start time)";
  if (offsetMinutes % 1440 === 0) return `${offsetMinutes / 1440} days before`;
  if (offsetMinutes % 60 === 0) return `${offsetMinutes / 60} hours before`;
  return `${offsetMinutes} minutes before`;
}

/**
 * Calculate the exact UTC moment a reminder should be dispatched (FR-24, FR-25)
 *
 * @param taskDate The calendar date of the task (Date or YYYY-MM-DD string)
 * @param startTime Optional HH:mm start time string. If omitted, task is all-day (00:00).
 * @param offsetMinutes Minutes prior to task start to dispatch the reminder
 * @param userTimeZone The recipient's IANA timezone (e.g. 'America/New_York', 'UTC')
 */
export function calculateReminderSendTime(
  taskDate: Date | string,
  startTime: string | null | undefined,
  offsetMinutes: number,
  userTimeZone: string = "UTC"
): Date {
  const dateStr = toDateString(taskDate);
  const timeStr = startTime && startTime.trim() !== "" ? startTime.trim() : "00:00";
  const localDateTimeStr = `${dateStr}T${timeStr}:00`;

  // fromZonedTime resolves the local wall-clock time in the given IANA timezone to an exact UTC timestamp
  const taskStartUtc = fromZonedTime(localDateTimeStr, userTimeZone);

  // Subtract the offset minutes
  const sendTimeMs = taskStartUtc.getTime() - offsetMinutes * 60 * 1000;
  return new Date(sendTimeMs);
}

/**
 * Automatically synchronize reminder jobs for a task (FR-24, FR-25)
 * Called when tasks are created, updated, rescheduled, or status-toggled.
 */
export async function syncTaskReminderJobs(taskId: string): Promise<void> {
  try {
    const task = await db.task.findUnique({
      where: { id: taskId },
      include: {
        assignee: {
          select: {
            id: true,
            email: true,
            timeZone: true,
            reminderPreference: true,
          },
        },
        assignees: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                timeZone: true,
                reminderPreference: true,
              },
            },
          },
        },
        createdBy: {
          select: {
            id: true,
            email: true,
            timeZone: true,
            reminderPreference: true,
          },
        },
        reminderOverrides: true,
      },
    });

    if (!task) return;

    // 1. If task is completed (DONE) or CANCELLED, cancel all pending reminder jobs
    if (task.status === TaskStatus.DONE || task.status === TaskStatus.CANCELLED) {
      await db.reminderJob.updateMany({
        where: {
          taskId: task.id,
          status: ReminderJobStatus.PENDING,
        },
        data: {
          status: ReminderJobStatus.CANCELLED,
        },
      });
      return;
    }

    // Determine target users: all assigned users (or single assignee or creator for unassigned tasks)
    const targetUsers =
      task.assignees && task.assignees.length > 0
        ? task.assignees.map((a) => a.user)
        : task.assignee
        ? [task.assignee]
        : task.createdBy
        ? [task.createdBy]
        : [];

    if (targetUsers.length === 0) return;

    const targetUserIds = targetUsers.map((u) => u.id);
    // Cancel reminder jobs for any users no longer assigned
    await db.reminderJob.updateMany({
      where: {
        taskId: task.id,
        userId: { notIn: targetUserIds },
        status: ReminderJobStatus.PENDING,
      },
      data: {
        status: ReminderJobStatus.CANCELLED,
      },
    });

    const now = new Date();

    // 2. Schedule reminders for each target user
    for (const targetUser of targetUsers) {
      const userPref = targetUser.reminderPreference;
      const taskOverride = task.reminderOverrides.find((o) => o.userId === targetUser.id);

      const isEnabled = taskOverride ? taskOverride.enabled : userPref ? userPref.enabled : true;

      if (!isEnabled) {
        await db.reminderJob.updateMany({
          where: {
            taskId: task.id,
            userId: targetUser.id,
            status: ReminderJobStatus.PENDING,
          },
          data: {
            status: ReminderJobStatus.CANCELLED,
          },
        });
        continue;
      }

      const offsets: number[] = taskOverride?.offsets?.length
        ? taskOverride.offsets
        : userPref?.defaultOffsets?.length
        ? userPref.defaultOffsets
        : DEFAULT_REMINDER_OFFSETS;

      const userTz = targetUser.timeZone || "UTC";

      for (const offset of offsets) {
        const sendAt = calculateReminderSendTime(
          task.date,
          task.startTime,
          offset,
          userTz
        );

        if (sendAt > now) {
          await db.reminderJob.upsert({
            where: {
              taskId_userId_offsetMinutes: {
                taskId: task.id,
                userId: targetUser.id,
                offsetMinutes: offset,
              },
            },
            update: {
              sendAt,
              status: ReminderJobStatus.PENDING,
              attempts: 0,
              error: null,
            },
            create: {
              taskId: task.id,
              userId: targetUser.id,
              offsetMinutes: offset,
              sendAt,
              status: ReminderJobStatus.PENDING,
            },
          });
        } else {
          await db.reminderJob.updateMany({
            where: {
              taskId: task.id,
              userId: targetUser.id,
              offsetMinutes: offset,
              status: ReminderJobStatus.PENDING,
            },
            data: {
              status: ReminderJobStatus.SKIPPED,
            },
          });
        }
      }
    }
  } catch (error) {
    console.error(`Failed to sync reminder jobs for task ${taskId}:`, error);
  }
}
