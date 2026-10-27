import { z } from "zod";
import { TaskStatus, TaskPriority } from "@prisma/client";

// Time format regex: "HH:mm" (24-hour format)
const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;

export const taskSchema = z
  .object({
    title: z.string().min(1, "Title is required").max(200, "Title is too long"),
    date: z.string().min(1, "Date is required"), // "YYYY-MM-DD"
    startTime: z
      .string()
      .regex(timeRegex, "Start time must be in HH:mm format")
      .optional()
      .nullable()
      .or(z.literal("")),
    endTime: z
      .string()
      .regex(timeRegex, "End time must be in HH:mm format")
      .optional()
      .nullable()
      .or(z.literal("")),
    description: z.string().max(2000, "Description is too long").optional().nullable(),
    status: z.nativeEnum(TaskStatus).default(TaskStatus.TODO),
    priority: z.nativeEnum(TaskPriority).default(TaskPriority.MEDIUM),
    location: z.string().max(255).optional().nullable(),
    color: z.string().max(50).optional().nullable(),
    teamId: z.string().optional().nullable(),
    assigneeId: z.string().optional().nullable(),
    assigneeIds: z.array(z.string()).optional().nullable(),
  })
  .superRefine((data, ctx) => {
    const hasStart = !!data.startTime && data.startTime.trim() !== "";
    const hasEnd = !!data.endTime && data.endTime.trim() !== "";

    // FR-05 Rule: endTime without startTime is invalid
    if (hasEnd && !hasStart) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Start time is required when end time is specified",
        path: ["startTime"],
      });
    }

    // FR-05 Rule: endTime must be strictly after startTime
    if (hasStart && hasEnd && data.startTime && data.endTime) {
      if (data.endTime <= data.startTime) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "End time must be after start time",
          path: ["endTime"],
        });
      }
    }
  });

export type TaskInput = z.infer<typeof taskSchema>;

export const batchTasksSchema = z.array(taskSchema).min(1, "At least one task is required");
export type BatchTasksInput = z.infer<typeof batchTasksSchema>;

export const rescheduleTaskSchema = z
  .object({
    taskId: z.string().min(1),
    date: z.string().min(1),
    startTime: z.string().optional().nullable(),
    endTime: z.string().optional().nullable(),
  })
  .superRefine((data, ctx) => {
    const hasStart = !!data.startTime && data.startTime.trim() !== "";
    const hasEnd = !!data.endTime && data.endTime.trim() !== "";

    if (hasEnd && !hasStart) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Start time is required when end time is specified",
        path: ["startTime"],
      });
    }

    if (hasStart && hasEnd && data.startTime && data.endTime) {
      if (data.endTime <= data.startTime) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "End time must be after start time",
          path: ["endTime"],
        });
      }
    }
  });

export type RescheduleTaskInput = z.infer<typeof rescheduleTaskSchema>;

export const convertPersonalTaskSchema = z.object({
  taskId: z.string().min(1, "Task ID is required"),
  teamId: z.string().min(1, "Team is required"),
  assigneeId: z.string().optional().nullable(),
  assigneeIds: z.array(z.string()).optional().nullable(),
});

export type ConvertPersonalTaskInput = z.infer<typeof convertPersonalTaskSchema>;

export const penaltySettingSchema = z.object({
  personalTasksEnabled: z.boolean().optional(),
  teamTasksEnabled: z.boolean().optional(),
});

export type PenaltySettingInput = z.infer<typeof penaltySettingSchema>;

export const calendarViewSchema = z.enum(["month", "week", "day", "agenda"]);
export type CalendarViewMode = z.infer<typeof calendarViewSchema>;

