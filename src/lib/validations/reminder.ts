import { z } from "zod";

export const reminderPreferenceSchema = z.object({
  enabled: z.boolean(),
  defaultOffsets: z
    .array(z.number().int().min(0))
    .min(1, "At least one reminder offset must be selected when reminders are enabled"),
});

export const taskReminderOverrideSchema = z.object({
  taskId: z.string().min(1),
  enabled: z.boolean(),
  offsets: z.array(z.number().int().min(0)),
});

export type ReminderPreferenceInput = z.infer<typeof reminderPreferenceSchema>;
export type TaskReminderOverrideInput = z.infer<typeof taskReminderOverrideSchema>;
