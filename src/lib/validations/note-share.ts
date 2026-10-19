import { z } from "zod";
import { NoteShareTargetType, NotePermission } from "@prisma/client";

export const shareNoteSchema = z.object({
  noteId: z.string().min(1, "Note ID is required"),
  targetType: z.nativeEnum(NoteShareTargetType),
  targetId: z.string().min(1, "Target is required"),
  permission: z.nativeEnum(NotePermission).default(NotePermission.VIEW),
});

export const removeNoteShareSchema = z.object({
  shareId: z.string().min(1, "Share ID is required"),
});

export type ShareNoteInput = z.infer<typeof shareNoteSchema>;
export type RemoveNoteShareInput = z.infer<typeof removeNoteShareSchema>;
