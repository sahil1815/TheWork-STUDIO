"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  shareNoteSchema,
  removeNoteShareSchema,
  ShareNoteInput,
} from "@/lib/validations/note-share";
import { NoteShareTargetType, NotePermission, NotificationType } from "@prisma/client";
import { revalidatePath } from "next/cache";

async function getAuthUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Unauthorized. Please sign in.");
  }
  return session.user.id;
}

/**
 * Share a Note with a User or Team (FR-22, FR-23)
 * Author-only operation.
 */
export async function shareNote(rawInput: ShareNoteInput) {
  try {
    const userId = await getAuthUserId();
    const validated = shareNoteSchema.parse(rawInput);

    // 1. Verify Note exists and user is author (FR-20, FR-23)
    const note = await db.note.findUnique({
      where: { id: validated.noteId },
      include: { author: { select: { id: true, name: true, email: true } } },
    });

    if (!note) {
      return { success: false, error: "Note not found." };
    }

    if (note.authorId !== userId) {
      return { success: false, error: "Only the author can share or manage shares for this note." };
    }

    // 2. Validate target
    if (validated.targetType === NoteShareTargetType.USER) {
      if (validated.targetId === userId) {
        return { success: false, error: "You cannot share a note with yourself." };
      }

      const targetUser = await db.user.findUnique({
        where: { id: validated.targetId },
        select: { id: true, name: true, email: true },
      });

      if (!targetUser) {
        return { success: false, error: "Target user not found." };
      }
    } else if (validated.targetType === NoteShareTargetType.TEAM) {
      const teamMember = await db.teamMember.findUnique({
        where: { teamId_userId: { teamId: validated.targetId, userId } },
      });

      if (!teamMember) {
        return { success: false, error: "You can only share notes with teams you belong to." };
      }
    }

    // 3. Upsert NoteShare
    const share = await db.noteShare.upsert({
      where: {
        noteId_targetType_targetId: {
          noteId: validated.noteId,
          targetType: validated.targetType,
          targetId: validated.targetId,
        },
      },
      update: {
        permission: validated.permission,
      },
      create: {
        noteId: validated.noteId,
        targetType: validated.targetType,
        targetId: validated.targetId,
        permission: validated.permission,
      },
    });

    // 4. In-app notifications
    const authorName = note.author.name || note.author.email;
    if (validated.targetType === NoteShareTargetType.USER) {
      await db.notification.create({
        data: {
          userId: validated.targetId,
          type: NotificationType.SYSTEM,
          title: "Note Shared with You",
          message: `${authorName} shared a note "${note.title}" with you (${validated.permission} access).`,
          link: "/notebook",
        },
      });
    } else if (validated.targetType === NoteShareTargetType.TEAM) {
      const members = await db.teamMember.findMany({
        where: { teamId: validated.targetId, userId: { not: userId } },
        select: { userId: true },
      });

      if (members.length > 0) {
        await db.notification.createMany({
          data: members.map((m) => ({
            userId: m.userId,
            type: NotificationType.SYSTEM,
            title: "Team Note Shared",
            message: `${authorName} shared the note "${note.title}" with your team.`,
            link: "/notebook",
          })),
        });
      }
    }

    revalidatePath("/notebook");
    return { success: true, share };
  } catch (error: unknown) {
    console.error("Failed to share note:", error);
    const message = error instanceof Error ? error.message : "Failed to share note";
    return { success: false, error: message };
  }
}

/**
 * Remove an existing note share (FR-23: author only)
 */
export async function removeNoteShare(shareId: string) {
  try {
    const userId = await getAuthUserId();

    const share = await db.noteShare.findUnique({
      where: { id: shareId },
      include: { note: true },
    });

    if (!share) {
      return { success: false, error: "Share not found." };
    }

    if (share.note.authorId !== userId) {
      return { success: false, error: "Only the note author can remove shares." };
    }

    await db.noteShare.delete({
      where: { id: shareId },
    });

    revalidatePath("/notebook");
    return { success: true };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to remove share";
    return { success: false, error: message };
  }
}

/**
 * Get all active shares for a note with resolved names
 */
export async function getNoteShares(noteId: string) {
  try {
    const userId = await getAuthUserId();

    const note = await db.note.findUnique({
      where: { id: noteId },
    });

    if (!note) return [];

    // Verify user is author or has access
    const isAuthor = note.authorId === userId;
    if (!isAuthor) {
      const userShare = await db.noteShare.findFirst({
        where: { noteId, targetType: NoteShareTargetType.USER, targetId: userId },
      });
      if (!userShare) {
        const userTeams = await db.teamMember.findMany({
          where: { userId },
          select: { teamId: true },
        });
        const teamIds = userTeams.map((t) => t.teamId);
        const teamShare = await db.noteShare.findFirst({
          where: { noteId, targetType: NoteShareTargetType.TEAM, targetId: { in: teamIds } },
        });
        if (!teamShare) return [];
      }
    }

    const shares = await db.noteShare.findMany({
      where: { noteId },
      orderBy: { createdAt: "asc" },
    });

    // Resolve target entities
    const resolvedShares = await Promise.all(
      shares.map(async (s) => {
        if (s.targetType === NoteShareTargetType.USER) {
          const u = await db.user.findUnique({
            where: { id: s.targetId },
            select: { id: true, name: true, email: true },
          });
          return {
            id: s.id,
            targetType: s.targetType,
            targetId: s.targetId,
            permission: s.permission,
            targetName: u?.name || u?.email || "Unknown User",
            targetEmail: u?.email || null,
          };
        } else {
          const t = await db.team.findUnique({
            where: { id: s.targetId },
            select: { id: true, name: true },
          });
          return {
            id: s.id,
            targetType: s.targetType,
            targetId: s.targetId,
            permission: s.permission,
            targetName: t?.name ? `Team: ${t.name}` : "Unknown Team",
            targetEmail: null,
          };
        }
      })
    );

    return resolvedShares;
  } catch (error) {
    console.error("Failed to get note shares:", error);
    return [];
  }
}

/**
 * Retrieve teams and teammates the current user can share notes with
 */
export async function getShareableRecipients() {
  try {
    const userId = await getAuthUserId();

    // 1. Teams user is a member of
    const memberships = await db.teamMember.findMany({
      where: { userId },
      include: {
        team: {
          select: {
            id: true,
            name: true,
            members: {
              include: {
                user: { select: { id: true, name: true, email: true } },
              },
            },
          },
        },
      },
    });

    const teams = memberships.map((m) => ({
      id: m.team.id,
      name: m.team.name,
      role: m.role,
    }));

    // 2. Teammates across all user's teams
    const teammateMap = new Map<string, { id: string; name: string | null; email: string }>();

    for (const m of memberships) {
      for (const tm of m.team.members) {
        if (tm.userId !== userId && !teammateMap.has(tm.userId)) {
          teammateMap.set(tm.userId, {
            id: tm.user.id,
            name: tm.user.name,
            email: tm.user.email,
          });
        }
      }
    }

    return {
      teams,
      users: Array.from(teammateMap.values()),
    };
  } catch (error) {
    console.error("Failed to get shareable recipients:", error);
    return { teams: [], users: [] };
  }
}
