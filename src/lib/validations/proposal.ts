import { z } from "zod";
import { TaskPriority } from "@prisma/client";

const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;

export const createProposalSchema = z
  .object({
    teamId: z.string().min(1, "Team is required"),
    recipientId: z.string().min(1, "Recipient is required"),
    title: z.string().min(1, "Title is required").max(200, "Title is too long"),
    date: z.string().min(1, "Date is required"), // YYYY-MM-DD
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
    description: z.string().max(2000).optional().nullable(),
    priority: z.nativeEnum(TaskPriority).default(TaskPriority.MEDIUM),
    location: z.string().max(255).optional().nullable(),
    color: z.string().max(50).optional().nullable(),
    message: z.string().max(1000).optional().nullable(),
  })
  .superRefine((data, ctx) => {
    const hasStart = !!data.startTime && data.startTime.trim() !== "";
    const hasEnd = !!data.endTime && data.endTime.trim() !== "";

    // FR-05 Timing rules: endTime without startTime is invalid
    if (hasEnd && !hasStart) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Start time is required when end time is specified",
        path: ["startTime"],
      });
    }

    // FR-05 Timing rules: endTime must be strictly after startTime
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

export const respondProposalSchema = z.object({
  proposalId: z.string().min(1),
  decision: z.enum(["ACCEPT", "DECLINE"]),
  message: z.string().max(1000).optional().nullable(),
});

export const cancelProposalSchema = z.object({
  proposalId: z.string().min(1),
});

export type CreateProposalInput = z.infer<typeof createProposalSchema>;

export const batchProposalsSchema = z.array(createProposalSchema).min(1, "At least one proposal is required");
export type BatchProposalsInput = z.infer<typeof batchProposalsSchema>;
export type RespondProposalInput = z.infer<typeof respondProposalSchema>;
export type CancelProposalInput = z.infer<typeof cancelProposalSchema>;
