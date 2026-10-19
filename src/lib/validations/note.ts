import { z } from "zod";

export const noteSchema = z.object({
  title: z.string().min(1, "Title cannot be empty").max(200, "Title is too long").default("Untitled Note"),
  contentJson: z.any().optional(),
  contentText: z.string().default(""),
  pinned: z.boolean().default(false),
  tags: z.array(z.string().min(1).max(30)).default([]),
});

export const updateNoteSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  contentJson: z.any().optional(),
  contentText: z.string().optional(),
  pinned: z.boolean().optional(),
  tags: z.array(z.string()).optional(),
});

export type NoteInput = z.infer<typeof noteSchema>;
export type UpdateNoteInput = z.infer<typeof updateNoteSchema>;
