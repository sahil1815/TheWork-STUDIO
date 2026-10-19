"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { can } from "@/lib/permissions";
import { generateSecureToken, hashToken } from "@/lib/token";
import {
  createTeamSchema,
  updateTeamSchema,
  inviteMemberSchema,
  changeRoleSchema,
  transferOwnershipSchema,
  CreateTeamInput,
  UpdateTeamInput,
  InviteMemberInput,
  ChangeRoleInput,
  TransferOwnershipInput,
} from "@/lib/validations/team";
import { Role, InvitationStatus, ProposalStatus } from "@prisma/client";
import { addDays } from "date-fns";
import { revalidatePath } from "next/cache";

async function getAuthUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Unauthorized. Please sign in.");
  }
  return session.user.id;
}

/**
 * Get user membership and role within a team
 */
async function getUserMembership(teamId: string, userId: string) {
  return db.teamMember.findUnique({
    where: { teamId_userId: { teamId, userId } },
    include: { team: true },
  });
}

/**
 * Create a new team (FR-10: Creator becomes Master Admin / OWNER)
 */
export async function createTeam(rawInput: CreateTeamInput) {
  try {
    const userId = await getAuthUserId();
    const validated = createTeamSchema.parse(rawInput);

    const team = await db.$transaction(async (tx) => {
      const newTeam = await tx.team.create({
        data: {
          name: validated.name.trim(),
        },
      });

      await tx.teamMember.create({
        data: {
          teamId: newTeam.id,
          userId,
          role: Role.OWNER, // Master Admin
        },
      });

      return newTeam;
    });

    revalidatePath("/teams");
    revalidatePath("/calendar");
    return { success: true, team };
  } catch (error: unknown) {
    console.error("Create team error:", error);
    const message = error instanceof Error ? error.message : "Failed to create team";
    return { success: false, error: message };
  }
}

/**
 * Rename team (FR-11: Master Admin only)
 */
export async function updateTeamName(teamId: string, rawInput: UpdateTeamInput) {
  try {
    const userId = await getAuthUserId();
    const validated = updateTeamSchema.parse(rawInput);
    const membership = await getUserMembership(teamId, userId);

    if (!can(membership?.role, "MANAGE_TEAM")) {
      return { success: false, error: "Only the Master Admin can rename the team." };
    }

    const team = await db.team.update({
      where: { id: teamId },
      data: { name: validated.name.trim() },
    });

    revalidatePath(`/teams/${teamId}`);
    revalidatePath("/teams");
    return { success: true, team };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to update team";
    return { success: false, error: message };
  }
}

/**
 * Delete team (FR-11: Master Admin only)
 */
export async function deleteTeam(teamId: string) {
  try {
    const userId = await getAuthUserId();
    const membership = await getUserMembership(teamId, userId);

    if (!can(membership?.role, "MANAGE_TEAM")) {
      return { success: false, error: "Only the Master Admin can delete the team." };
    }

    await db.team.delete({
      where: { id: teamId },
    });

    revalidatePath("/teams");
    revalidatePath("/calendar");
    return { success: true };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to delete team";
    return { success: false, error: message };
  }
}

/**
 * Transfer ownership of team to another member (FR-13)
 */
export async function transferTeamOwnership(teamId: string, rawInput: TransferOwnershipInput) {
  try {
    const userId = await getAuthUserId();
    const validated = transferOwnershipSchema.parse(rawInput);
    const membership = await getUserMembership(teamId, userId);

    if (!can(membership?.role, "MANAGE_TEAM")) {
      return { success: false, error: "Only the current Master Admin can transfer ownership." };
    }

    const targetMembership = await getUserMembership(teamId, validated.newOwnerUserId);
    if (!targetMembership) {
      return { success: false, error: "Target user is not a member of this team." };
    }

    if (targetMembership.userId === userId) {
      return { success: false, error: "You are already the Master Admin." };
    }

    // Atomically transfer ownership
    await db.$transaction(async (tx) => {
      // 1. Demote current owner to ADMIN
      await tx.teamMember.update({
        where: { id: membership!.id },
        data: { role: Role.ADMIN },
      });

      // 2. Promote target user to OWNER
      await tx.teamMember.update({
        where: { id: targetMembership.id },
        data: { role: Role.OWNER },
      });
    });

    revalidatePath(`/teams/${teamId}`);
    revalidatePath("/teams");
    return { success: true };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to transfer ownership";
    return { success: false, error: message };
  }
}

/**
 * Assign or change member role (FR-11: Master Admin only)
 */
export async function changeMemberRole(teamId: string, rawInput: ChangeRoleInput) {
  try {
    const userId = await getAuthUserId();
    const validated = changeRoleSchema.parse(rawInput);
    const membership = await getUserMembership(teamId, userId);

    if (!can(membership?.role, "ASSIGN_ROLE")) {
      return { success: false, error: "Only the Master Admin can change member roles." };
    }

    const targetMembership = await getUserMembership(teamId, validated.targetUserId);
    if (!targetMembership) {
      return { success: false, error: "Member not found in team." };
    }

    if (targetMembership.role === Role.OWNER) {
      return { success: false, error: "Cannot change role of Master Admin. Transfer ownership instead." };
    }

    await db.teamMember.update({
      where: { id: targetMembership.id },
      data: { role: validated.newRole },
    });

    revalidatePath(`/teams/${teamId}`);
    return { success: true };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to change role";
    return { success: false, error: message };
  }
}

/**
 * Remove a member from the team (FR-12, FR-13: Master Admin only)
 */
export async function removeMember(teamId: string, targetUserId: string) {
  try {
    const userId = await getAuthUserId();
    const membership = await getUserMembership(teamId, userId);

    if (!can(membership?.role, "REMOVE_MEMBER")) {
      return { success: false, error: "Only the Master Admin can remove members." };
    }

    if (targetUserId === userId) {
      return { success: false, error: "Master Admin cannot be removed. Transfer ownership or delete team." };
    }

    const targetMembership = await getUserMembership(teamId, targetUserId);
    if (!targetMembership) {
      return { success: false, error: "Member not found in team." };
    }

    // Edge Case (Section 9): Clean up member dependencies
    await db.$transaction(async (tx) => {
      // Cancel pending proposals involving this user in this team
      await tx.taskProposal.updateMany({
        where: {
          teamId,
          OR: [{ proposerId: targetUserId }, { recipientId: targetUserId }],
          status: ProposalStatus.PENDING,
        },
        data: { status: ProposalStatus.CANCELLED },
      });

      // Unassign target user from team tasks
      await tx.task.updateMany({
        where: { teamId, assigneeId: targetUserId },
        data: { assigneeId: null },
      });

      // Delete membership
      await tx.teamMember.delete({
        where: { id: targetMembership.id },
      });
    });

    revalidatePath(`/teams/${teamId}`);
    return { success: true };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to remove member";
    return { success: false, error: message };
  }
}

/**
 * Leave team (FR-13: Non-owners only)
 */
export async function leaveTeam(teamId: string) {
  try {
    const userId = await getAuthUserId();
    const membership = await getUserMembership(teamId, userId);

    if (!membership) {
      return { success: false, error: "You are not a member of this team." };
    }

    if (!can(membership.role, "LEAVE_TEAM")) {
      return {
        success: false,
        error: "Master Admin cannot leave the team. Transfer ownership or delete the team first.",
      };
    }

    await db.$transaction(async (tx) => {
      // Cancel pending proposals
      await tx.taskProposal.updateMany({
        where: {
          teamId,
          OR: [{ proposerId: userId }, { recipientId: userId }],
          status: ProposalStatus.PENDING,
        },
        data: { status: ProposalStatus.CANCELLED },
      });

      // Unassign user from team tasks
      await tx.task.updateMany({
        where: { teamId, assigneeId: userId },
        data: { assigneeId: null },
      });

      // Delete membership
      await tx.teamMember.delete({
        where: { id: membership.id },
      });
    });

    revalidatePath("/teams");
    revalidatePath("/calendar");
    return { success: true };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to leave team";
    return { success: false, error: message };
  }
}

/**
 * Send an invitation (FR-14, FR-15, FR-16: Two-step approval)
 */
export async function sendTeamInvitation(teamId: string, rawInput: InviteMemberInput) {
  try {
    const userId = await getAuthUserId();
    const validated = inviteMemberSchema.parse(rawInput);
    const membership = await getUserMembership(teamId, userId);

    if (!can(membership?.role, "SEND_INVITATION")) {
      return { success: false, error: "You do not have permission to invite members." };
    }

    const normalizedEmail = validated.email.toLowerCase().trim();

    // 1. Check if already a member
    const existingMember = await db.teamMember.findFirst({
      where: {
        teamId,
        user: { email: normalizedEmail },
      },
    });

    if (existingMember) {
      return { success: false, error: "This person is already a member of the team." };
    }

    // 2. Prevent duplicate pending/approved invitations for the same email and team (FR-16)
    const existingInvite = await db.teamInvitation.findFirst({
      where: {
        teamId,
        email: normalizedEmail,
        status: { in: [InvitationStatus.PENDING_APPROVAL, InvitationStatus.APPROVED] },
        expiresAt: { gt: new Date() },
      },
    });

    if (existingInvite) {
      return {
        success: false,
        error: "An active invitation for this email already exists for this team.",
      };
    }

    const plainToken = generateSecureToken(32);
    const tokenHash = hashToken(plainToken);
    const expiresAt = addDays(new Date(), 7); // Default 7-day expiration (Assumption 5)

    const isMasterAdmin = membership!.role === Role.OWNER;
    const initialStatus = isMasterAdmin ? InvitationStatus.APPROVED : InvitationStatus.PENDING_APPROVAL;

    const invitation = await db.teamInvitation.create({
      data: {
        teamId,
        email: normalizedEmail,
        proposedRole: validated.proposedRole,
        invitedById: userId,
        status: initialStatus,
        approvedById: isMasterAdmin ? userId : null,
        tokenHash,
        expiresAt,
      },
    });

    // If Admin invited, notify Master Admin for review
    if (!isMasterAdmin) {
      const teamOwner = await db.teamMember.findFirst({
        where: { teamId, role: Role.OWNER },
      });

      if (teamOwner) {
        await db.notification.create({
          data: {
            userId: teamOwner.userId,
            type: "INVITATION",
            title: `Invitation Approval Requested: ${normalizedEmail}`,
            message: `Admin invited ${normalizedEmail} as ${validated.proposedRole}. Master Admin approval required.`,
            link: `/teams/${teamId}`,
          },
        });
      }
    }

    revalidatePath(`/teams/${teamId}`);

    return {
      success: true,
      invitation,
      token: isMasterAdmin ? plainToken : null,
      message: isMasterAdmin
        ? "Invitation approved and ready to share!"
        : "Invitation submitted for Master Admin approval.",
    };
  } catch (error: unknown) {
    console.error("Invite error:", error);
    const message = error instanceof Error ? error.message : "Failed to send invitation";
    return { success: false, error: message };
  }
}

/**
 * Master Admin reviews and approves or rejects an invitation (FR-15, FR-16)
 */
export async function reviewInvitation(
  invitationId: string,
  decision: "APPROVE" | "REJECT",
  finalRole?: Role
) {
  try {
    const userId = await getAuthUserId();

    const invitation = await db.teamInvitation.findUnique({
      where: { id: invitationId },
      include: { team: true },
    });

    if (!invitation) {
      return { success: false, error: "Invitation not found." };
    }

    const membership = await getUserMembership(invitation.teamId, userId);
    if (!can(membership?.role, "APPROVE_INVITATION")) {
      return { success: false, error: "Only the Master Admin can approve or reject invitations." };
    }

    if (decision === "REJECT") {
      await db.teamInvitation.update({
        where: { id: invitationId },
        data: { status: InvitationStatus.REJECTED },
      });
      revalidatePath(`/teams/${invitation.teamId}`);
      return { success: true, message: "Invitation rejected." };
    }

    // Approve flow
    const plainToken = generateSecureToken(32);
    const tokenHash = hashToken(plainToken);

    const updated = await db.teamInvitation.update({
      where: { id: invitationId },
      data: {
        status: InvitationStatus.APPROVED,
        approvedById: userId,
        proposedRole: finalRole || invitation.proposedRole,
        tokenHash, // Refresh token hash on approval
        expiresAt: addDays(new Date(), 7),
      },
    });

    revalidatePath(`/teams/${invitation.teamId}`);
    return {
      success: true,
      invitation: updated,
      token: plainToken,
      message: "Invitation approved successfully.",
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to review invitation";
    return { success: false, error: message };
  }
}

/**
 * Master Admin revokes an invitation (FR-16)
 */
export async function revokeInvitation(invitationId: string) {
  try {
    const userId = await getAuthUserId();
    const invitation = await db.teamInvitation.findUnique({
      where: { id: invitationId },
    });

    if (!invitation) return { success: false, error: "Invitation not found" };

    const membership = await getUserMembership(invitation.teamId, userId);
    if (!can(membership?.role, "APPROVE_INVITATION")) {
      return { success: false, error: "Only the Master Admin can revoke invitations." };
    }

    await db.teamInvitation.update({
      where: { id: invitationId },
      data: { status: InvitationStatus.REVOKED },
    });

    revalidatePath(`/teams/${invitation.teamId}`);
    return { success: true };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to revoke invitation";
    return { success: false, error: message };
  }
}

/**
 * Invitee accepts a team invitation via single-use token (FR-16)
 */
export async function acceptTeamInvitation(plainToken: string) {
  try {
    const userId = await getAuthUserId();
    const hashed = hashToken(plainToken);

    const invitation = await db.teamInvitation.findUnique({
      where: { tokenHash: hashed },
      include: { team: true },
    });

    if (!invitation) {
      return { success: false, error: "Invalid invitation link." };
    }

    if (invitation.status === InvitationStatus.ACCEPTED) {
      return { success: false, error: "This invitation has already been used." };
    }

    if (invitation.status === InvitationStatus.REVOKED) {
      return { success: false, error: "This invitation has been revoked by the Master Admin." };
    }

    if (invitation.status !== InvitationStatus.APPROVED) {
      return { success: false, error: "This invitation is pending Master Admin approval." };
    }

    if (new Date() > invitation.expiresAt) {
      await db.teamInvitation.update({
        where: { id: invitation.id },
        data: { status: InvitationStatus.EXPIRED },
      });
      return { success: false, error: "This invitation has expired. Please ask for a new invite." };
    }

    // Check if user is already a member
    const existing = await db.teamMember.findUnique({
      where: { teamId_userId: { teamId: invitation.teamId, userId } },
    });

    if (existing) {
      await db.teamInvitation.update({
        where: { id: invitation.id },
        data: { status: InvitationStatus.ACCEPTED },
      });
      return { success: true, teamId: invitation.teamId, message: "You are already a member of this team." };
    }

    // Join team
    await db.$transaction(async (tx) => {
      await tx.teamMember.create({
        data: {
          teamId: invitation.teamId,
          userId,
          role: invitation.proposedRole,
        },
      });

      await tx.teamInvitation.update({
        where: { id: invitation.id },
        data: { status: InvitationStatus.ACCEPTED },
      });
    });

    revalidatePath("/teams");
    revalidatePath(`/teams/${invitation.teamId}`);
    revalidatePath("/calendar");

    return {
      success: true,
      teamId: invitation.teamId,
      message: `Successfully joined ${invitation.team.name}!`,
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to accept invitation";
    return { success: false, error: message };
  }
}

/**
 * Get comprehensive team details including members and invitations
 */
export async function getTeamDetails(teamId: string) {
  try {
    const userId = await getAuthUserId();
    const membership = await getUserMembership(teamId, userId);

    if (!membership || !can(membership.role, "VIEW_TEAM")) {
      return null;
    }

    const team = await db.team.findUnique({
      where: { id: teamId },
      include: {
        members: {
          include: {
            user: {
              select: { id: true, name: true, email: true, image: true },
            },
          },
          orderBy: [{ role: "asc" }, { joinedAt: "asc" }],
        },
        invitations: {
          include: {
            invitedBy: { select: { id: true, name: true, email: true } },
            approvedBy: { select: { id: true, name: true, email: true } },
          },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    return {
      ...team,
      currentUserRole: membership.role,
    };
  } catch (error) {
    console.error("Failed to get team details:", error);
    return null;
  }
}
