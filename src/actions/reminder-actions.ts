"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  reminderPreferenceSchema,
  ReminderPreferenceInput,
} from "@/lib/validations/reminder";
import { DEFAULT_REMINDER_OFFSETS, syncTaskReminderJobs } from "@/lib/reminders";
import { TaskStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";

async function getAuthUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Unauthorized. Please sign in.");
  }
  return session.user.id;
}

/**
 * Fetch current user's email reminder preferences (FR-25)
 */
export async function getReminderPreferences() {
  try {
    const userId = await getAuthUserId();

    const pref = await db.reminderPreference.findUnique({
      where: { userId },
    });

    if (!pref) {
      return {
        enabled: true,
        defaultOffsets: DEFAULT_REMINDER_OFFSETS,
      };
    }

    return {
      enabled: pref.enabled,
      defaultOffsets: pref.defaultOffsets,
    };
  } catch (error) {
    console.error("Failed to fetch reminder preferences:", error);
    return {
      enabled: true,
      defaultOffsets: DEFAULT_REMINDER_OFFSETS,
    };
  }
}

/**
 * Update user's reminder preferences and recalculate active reminder jobs (FR-25)
 */
export async function updateReminderPreferences(rawInput: ReminderPreferenceInput) {
  try {
    const userId = await getAuthUserId();
    const validated = reminderPreferenceSchema.parse(rawInput);

    const pref = await db.reminderPreference.upsert({
      where: { userId },
      update: {
        enabled: validated.enabled,
        defaultOffsets: validated.defaultOffsets,
      },
      create: {
        userId,
        enabled: validated.enabled,
        defaultOffsets: validated.defaultOffsets,
      },
    });

    // Re-sync reminder jobs for all active (TODO / IN_PROGRESS) tasks of this user
    const userTasks = await db.task.findMany({
      where: {
        OR: [{ assigneeId: userId }, { createdById: userId }],
        status: { in: [TaskStatus.TODO, TaskStatus.IN_PROGRESS] },
      },
      select: { id: true },
    });

    for (const task of userTasks) {
      await syncTaskReminderJobs(task.id);
    }

    revalidatePath("/settings/account");
    return { success: true, preferences: pref };
  } catch (error: unknown) {
    console.error("Failed to update reminder preferences:", error);
    const message = error instanceof Error ? error.message : "Failed to update preferences";
    return { success: false, error: message };
  }
}
