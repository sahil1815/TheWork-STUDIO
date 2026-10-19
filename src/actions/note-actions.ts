"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { updateNoteSchema, UpdateNoteInput } from "@/lib/validations/note";
import { NoteShareTargetType, NotePermission, Role } from "@prisma/client";
import { revalidatePath } from "next/cache";

async function getAuthUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Unauthorized. Please sign in.");
  }
  return session.user.id;
}

export interface NoteWithPermissions {
  id: string;
  authorId: string;
  title: string;
  contentJson: any;
  contentText: string;
  pinned: boolean;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
  isOwner: boolean;
  permission: "OWNER" | "EDIT" | "VIEW";
  authorName?: string;
  sharedVia?: "USER" | "TEAM";
}

/**
 * Fetch all notes accessible by user (personal + shared) (FR-20, FR-21, FR-22, FR-23)
 */
export async function getNotes(search?: string, tag?: string): Promise<NoteWithPermissions[]> {
  try {
    const userId = await getAuthUserId();

    // 1. Get user's team memberships to check for team-shared notes and handle Guest constraints
    const memberships = await db.teamMember.findMany({
      where: { userId },
      select: { teamId: true, role: true },
    });

    const userTeamIds = memberships.map((m) => m.teamId);
    const teamRoleMap = new Map<string, Role>(memberships.map((m) => [m.teamId, m.role]));

    // 2. Build search/tag filters
    const filterConditions: any[] = [];
    if (search && search.trim() !== "") {
      const q = search.trim();
      filterConditions.push({
        OR: [
          { title: { contains: q, mode: "insensitive" } },
          { contentText: { contains: q, mode: "insensitive" } },
        ],
      });
    }

    if (tag && tag.trim() !== "") {
      filterConditions.push({
        tags: { has: tag.trim() },
      });
    }

    // 3. Query Personal Notes (FR-20)
    const personalNotes = await db.note.findMany({
      where: {
        authorId: userId,
        ...(filterConditions.length > 0 ? { AND: filterConditions } : {}),
      },
      orderBy: [{ pinned: "desc" }, { updatedAt: "desc" }],
    });

    // 4. Query Shared Notes (FR-22, FR-23)
    const sharedNotes = await db.note.findMany({
      where: {
        authorId: { not: userId },
        shares: {
          some: {
            OR: [
              { targetType: NoteShareTargetType.USER, targetId: userId },
              ...(userTeamIds.length > 0
                ? [{ targetType: NoteShareTargetType.TEAM, targetId: { in: userTeamIds } }]
                : []),
            ],
          },
        },
        ...(filterConditions.length > 0 ? { AND: filterConditions } : {}),
      },
      include: {
        author: { select: { id: true, name: true, email: true } },
        shares: {
          where: {
            OR: [
              { targetType: NoteShareTargetType.USER, targetId: userId },
              ...(userTeamIds.length > 0
                ? [{ targetType: NoteShareTargetType.TEAM, targetId: { in: userTeamIds } }]
                : []),
            ],
          },
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    const formattedPersonalNotes: NoteWithPermissions[] = personalNotes.map((n) => ({
      ...n,
      isOwner: true,
      permission: "OWNER",
    }));

    const formattedSharedNotes: NoteWithPermissions[] = sharedNotes.map((n) => {
      // Determine highest permission granted
      let effectivePerm: "EDIT" | "VIEW" = "VIEW";
      let sharedVia: "USER" | "TEAM" = "USER";

      for (const s of n.shares) {
        if (s.targetType === NoteShareTargetType.USER) {
          sharedVia = "USER";
          if (s.permission === NotePermission.EDIT) {
            effectivePerm = "EDIT";
          }
        } else if (s.targetType === NoteShareTargetType.TEAM) {
          sharedVia = "TEAM";
          const userRole = teamRoleMap.get(s.targetId);
          // FR-22: Guests in a team can ONLY receive VIEW permission
          if (s.permission === NotePermission.EDIT && userRole !== Role.GUEST) {
            effectivePerm = "EDIT";
          }
        }
      }

      return {
        id: n.id,
        authorId: n.authorId,
        title: n.title,
        contentJson: n.contentJson,
        contentText: n.contentText,
        pinned: false, // Pinned is only for personal notes
        tags: n.tags,
        createdAt: n.createdAt,
        updatedAt: n.updatedAt,
        isOwner: false,
        permission: effectivePerm,
        authorName: n.author.name || n.author.email,
        sharedVia,
      };
    });

    return [...formattedPersonalNotes, ...formattedSharedNotes];
  } catch (error) {
    console.error("Failed to fetch notes:", error);
    return [];
  }
}

/**
 * Get a specific note by ID with effective permissions (FR-20, FR-22)
 */
export async function getNoteById(noteId: string): Promise<NoteWithPermissions | null> {
  try {
    const userId = await getAuthUserId();

    const note = await db.note.findUnique({
      where: { id: noteId },
      include: {
        author: { select: { id: true, name: true, email: true } },
        shares: true,
      },
    });

    if (!note) return null;

    if (note.authorId === userId) {
      return {
        ...note,
        isOwner: true,
        permission: "OWNER",
      };
    }

    // Check shares
    const memberships = await db.teamMember.findMany({
      where: { userId },
      select: { teamId: true, role: true },
    });
    const teamRoleMap = new Map<string, Role>(memberships.map((m) => [m.teamId, m.role]));

    let effectivePerm: "EDIT" | "VIEW" | null = null;
    let sharedVia: "USER" | "TEAM" = "USER";

    for (const s of note.shares) {
      if (s.targetType === NoteShareTargetType.USER && s.targetId === userId) {
        sharedVia = "USER";
        if (s.permission === NotePermission.EDIT) {
          effectivePerm = "EDIT";
        } else if (!effectivePerm) {
          effectivePerm = "VIEW";
        }
      } else if (s.targetType === NoteShareTargetType.TEAM && teamRoleMap.has(s.targetId)) {
        sharedVia = "TEAM";
        const role = teamRoleMap.get(s.targetId);
        // FR-22: Guests restricted to VIEW
        if (s.permission === NotePermission.EDIT && role !== Role.GUEST) {
          effectivePerm = "EDIT";
        } else if (!effectivePerm) {
          effectivePerm = "VIEW";
        }
      }
    }

    if (!effectivePerm) {
      return null; // No access
    }

    return {
      id: note.id,
      authorId: note.authorId,
      title: note.title,
      contentJson: note.contentJson,
      contentText: note.contentText,
      pinned: false,
      tags: note.tags,
      createdAt: note.createdAt,
      updatedAt: note.updatedAt,
      isOwner: false,
      permission: effectivePerm,
      authorName: note.author.name || note.author.email,
      sharedVia,
    };
  } catch (error) {
    console.error("Failed to fetch note:", error);
    return null;
  }
}

/**
 * Create a new personal note (FR-20: private by default)
 */
export async function createNote(initialTitle?: string) {
  try {
    const userId = await getAuthUserId();

    const note = await db.note.create({
      data: {
        authorId: userId,
        title: initialTitle?.trim() || "Untitled Note",
        contentJson: {
          type: "doc",
          content: [],
        },
        contentText: "",
        pinned: false,
        tags: [],
      },
    });

    revalidatePath("/notebook");
    return {
      success: true,
      note: {
        ...note,
        isOwner: true,
        permission: "OWNER" as const,
      },
    };
  } catch (error: unknown) {
    console.error("Failed to create note:", error);
    const message = error instanceof Error ? error.message : "Failed to create note";
    return { success: false, error: message };
  }
}

/**
 * Update a note with autosave support (FR-20, FR-22: collaborative editing for EDIT permissions)
 */
export async function updateNote(noteId: string, rawInput: UpdateNoteInput) {
  try {
    const userId = await getAuthUserId();
    const validated = updateNoteSchema.parse(rawInput);

    const existingNote = await getNoteById(noteId);

    if (!existingNote) {
      return { success: false, error: "Note not found or you lack permission to view it." };
    }

    if (existingNote.permission === "VIEW") {
      return { success: false, error: "Read-only access. You cannot edit this shared note." };
    }

    // Owner can update everything. Shared editor can update content, title, tags, but NOT pinned status.
    const updateData: any = {
      title: validated.title !== undefined ? validated.title : existingNote.title,
      contentJson: validated.contentJson !== undefined ? validated.contentJson : existingNote.contentJson,
      contentText: validated.contentText !== undefined ? validated.contentText : existingNote.contentText,
      tags: validated.tags !== undefined ? validated.tags : existingNote.tags,
    };

    if (existingNote.isOwner && validated.pinned !== undefined) {
      updateData.pinned = validated.pinned;
    }

    const updated = await db.note.update({
      where: { id: noteId },
      data: updateData,
    });

    revalidatePath("/notebook");
    return {
      success: true,
      note: {
        ...updated,
        isOwner: existingNote.isOwner,
        permission: existingNote.permission,
        authorName: existingNote.authorName,
      },
    };
  } catch (error: unknown) {
    console.error("Failed to update note:", error);
    const message = error instanceof Error ? error.message : "Failed to update note";
    return { success: false, error: message };
  }
}

/**
 * Toggle pinned status for a note (FR-20: author only)
 */
export async function togglePinNote(noteId: string) {
  try {
    const userId = await getAuthUserId();

    const existing = await db.note.findUnique({
      where: { id: noteId },
    });

    if (!existing || existing.authorId !== userId) {
      return { success: false, error: "Note not found or unauthorized. Only the author can pin notes." };
    }

    const updated = await db.note.update({
      where: { id: noteId },
      data: { pinned: !existing.pinned },
    });

    revalidatePath("/notebook");
    return { success: true, pinned: updated.pinned };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to pin note";
    return { success: false, error: message };
  }
}

/**
 * Delete a note (FR-20, FR-23: author only)
 */
export async function deleteNote(noteId: string) {
  try {
    const userId = await getAuthUserId();

    const existing = await db.note.findUnique({
      where: { id: noteId },
    });

    if (!existing || existing.authorId !== userId) {
      return { success: false, error: "Note not found or unauthorized. Only the author can delete a note." };
    }

    await db.note.delete({
      where: { id: noteId },
    });

    revalidatePath("/notebook");
    return { success: true };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to delete note";
    return { success: false, error: message };
  }
}

/**
 * Retrieve all unique tags used across a user's accessible notes
 */
export async function getAllUserTags(): Promise<string[]> {
  try {
    const notes = await getNotes();
    const tagsSet = new Set<string>();

    for (const n of notes) {
      for (const t of n.tags) {
        tagsSet.add(t);
      }
    }

    return Array.from(tagsSet).sort();
  } catch {
    return [];
  }
}
