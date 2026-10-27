"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { can } from "@/lib/permissions";
import {
  createProposalSchema,
  respondProposalSchema,
  cancelProposalSchema,
  batchProposalsSchema,
  CreateProposalInput,
  BatchProposalsInput,
  RespondProposalInput,
} from "@/lib/validations/proposal";
import { parseDateString, toDateString } from "@/lib/date-utils";
import { Role, ProposalStatus, TaskStatus, InvitationStatus } from "@prisma/client";
import { addDays } from "date-fns";
import { revalidatePath } from "next/cache";
import { syncTaskReminderJobs } from "@/lib/reminders";

async function getAuthUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Unauthorized. Please sign in.");
  }
  return session.user.id;
}

/**
 * Propose a Task to another member of the same team (FR-17, FR-18, FR-19)
 */
export async function createTaskProposal(rawInput: CreateProposalInput) {
  try {
    const userId = await getAuthUserId();
    const validated = createProposalSchema.parse(rawInput);

    if (validated.recipientId === userId) {
      return { success: false, error: "You cannot propose a task to yourself. Create a regular task instead." };
    }

    // 1. Verify Proposer membership & permissions in team (FR-19: Guests cannot propose)
    const proposerMember = await db.teamMember.findUnique({
      where: { teamId_userId: { teamId: validated.teamId, userId } },
    });

    if (!proposerMember || !can(proposerMember.role, "PROPOSE_TASK")) {
      return { success: false, error: "You do not have permission to propose tasks in this team." };
    }

    // 2. Verify Recipient membership (FR-19: Guests cannot receive proposals)
    const recipientMember = await db.teamMember.findUnique({
      where: { teamId_userId: { teamId: validated.teamId, userId: validated.recipientId } },
      include: { user: { select: { name: true, email: true } } },
    });

    if (!recipientMember) {
      return { success: false, error: "Recipient is not a member of this team." };
    }

    if (recipientMember.role === Role.GUEST) {
      return { success: false, error: "Tasks cannot be proposed to Guests (view-only role)." };
    }

    const taskDate = parseDateString(validated.date);
    const expiresAt = addDays(new Date(), 14); // 14-day expiry (Assumption 5)

    const proposal = await db.$transaction(async (tx) => {
      const created = await tx.taskProposal.create({
        data: {
          teamId: validated.teamId,
          proposerId: userId,
          recipientId: validated.recipientId,
          title: validated.title.trim(),
          date: taskDate,
          startTime: validated.startTime && validated.startTime.trim() !== "" ? validated.startTime : null,
          endTime: validated.endTime && validated.endTime.trim() !== "" ? validated.endTime : null,
          description: validated.description?.trim() || null,
          priority: validated.priority,
          location: validated.location?.trim() || null,
          color: validated.color || "#8b5cf6",
          message: validated.message?.trim() || null,
          status: ProposalStatus.PENDING,
          expiresAt,
        },
        include: {
          team: { select: { name: true } },
          proposer: { select: { name: true, email: true } },
        },
      });

      // In-app notification for the recipient (FR-28)
      await tx.notification.create({
        data: {
          userId: validated.recipientId,
          type: "TASK_PROPOSAL",
          title: `New Task Proposal from ${created.proposer.name || created.proposer.email}`,
          message: `Proposed: "${created.title}" in team "${created.team.name}"`,
          link: "/inbox",
          data: { proposalId: created.id },
        },
      });

      return created;
    });

    revalidatePath("/inbox");
    revalidatePath("/tasks");
    revalidatePath("/calendar");
    return { success: true, proposal };
  } catch (error: unknown) {
    console.error("Create proposal error:", error);
    const message = error instanceof Error ? error.message : "Failed to propose task";
    return { success: false, error: message };
  }
}

/**
 * Propose multiple tasks in batch (FR-17, FR-18, FR-19)
 * Tasks can be on the same date or different dates, for same or different team members.
 */
export async function createBatchTaskProposals(rawInputs: CreateProposalInput[]) {
  try {
    const userId = await getAuthUserId();
    if (!rawInputs || !Array.isArray(rawInputs) || rawInputs.length === 0) {
      return { success: false, error: "At least one proposal is required." };
    }

    const validatedProposals = rawInputs.map((input, index) => {
      const parsed = createProposalSchema.safeParse(input);
      if (!parsed.success) {
        const firstError = parsed.error.issues[0]?.message || "Invalid proposal data";
        throw new Error(`Proposal #${index + 1}: ${firstError}`);
      }
      if (parsed.data.recipientId === userId) {
        throw new Error(`Proposal #${index + 1}: You cannot propose a task to yourself. Create a regular task instead.`);
      }
      return parsed.data;
    });

    // Verify proposer permissions in all involved teams
    const uniqueTeamIds = Array.from(new Set(validatedProposals.map((p) => p.teamId)));
    const proposerMembers = await db.teamMember.findMany({
      where: {
        userId,
        teamId: { in: uniqueTeamIds },
      },
    });
    const proposerMemberMap = new Map(proposerMembers.map((m) => [m.teamId, m]));

    for (let i = 0; i < validatedProposals.length; i++) {
      const p = validatedProposals[i];
      const member = proposerMemberMap.get(p.teamId);
      if (!member || !can(member.role, "PROPOSE_TASK")) {
        throw new Error(`Proposal #${i + 1}: You do not have permission to propose tasks in this team.`);
      }
    }

    // Verify recipient memberships (must be in the specified team, cannot be GUEST)
    for (let i = 0; i < validatedProposals.length; i++) {
      const p = validatedProposals[i];
      const recipientMember = await db.teamMember.findUnique({
        where: { teamId_userId: { teamId: p.teamId, userId: p.recipientId } },
        include: { user: { select: { name: true, email: true } } },
      });

      if (!recipientMember) {
        throw new Error(`Proposal #${i + 1}: Recipient is not a member of this team.`);
      }
      if (recipientMember.role === Role.GUEST) {
        throw new Error(`Proposal #${i + 1}: Tasks cannot be proposed to Guests (view-only role).`);
      }
    }

    const expiresAt = addDays(new Date(), 14);

    const createdProposals = await db.$transaction(async (tx) => {
      const results = [];
      for (const p of validatedProposals) {
        const taskDate = parseDateString(p.date);
        const created = await tx.taskProposal.create({
          data: {
            teamId: p.teamId,
            proposerId: userId,
            recipientId: p.recipientId,
            title: p.title.trim(),
            date: taskDate,
            startTime: p.startTime && p.startTime.trim() !== "" ? p.startTime : null,
            endTime: p.endTime && p.endTime.trim() !== "" ? p.endTime : null,
            description: p.description?.trim() || null,
            priority: p.priority,
            location: p.location?.trim() || null,
            color: p.color || "#8b5cf6",
            message: p.message?.trim() || null,
            status: ProposalStatus.PENDING,
            expiresAt,
          },
          include: {
            team: { select: { name: true } },
            proposer: { select: { name: true, email: true } },
          },
        });

        await tx.notification.create({
          data: {
            userId: p.recipientId,
            type: "TASK_PROPOSAL",
            title: `New Task Proposal from ${created.proposer.name || created.proposer.email}`,
            message: `Proposed: "${created.title}" in team "${created.team.name}"`,
            link: "/inbox",
            data: { proposalId: created.id },
          },
        });

        results.push(created);
      }
      return results;
    });

    revalidatePath("/inbox");
    revalidatePath("/tasks");
    revalidatePath("/calendar");
    return { success: true, count: createdProposals.length, proposals: createdProposals };
  } catch (error: unknown) {
    console.error("Create batch proposals error:", error);
    const message = error instanceof Error ? error.message : "Failed to propose tasks";
    return { success: false, error: message };
  }
}

/**
 * Get all teams where current user has permission to propose tasks (FR-19)
 * with their active non-guest members.
 */
export async function getUserProposableTeams() {
  try {
    const userId = await getAuthUserId();
    const memberships = await db.teamMember.findMany({
      where: {
        userId,
        role: { in: [Role.OWNER, Role.ADMIN, Role.MEMBER] },
      },
      include: {
        team: {
          include: {
            members: {
              include: {
                user: {
                  select: { id: true, name: true, email: true },
                },
              },
            },
          },
        },
      },
    });

    return memberships.map((m) => ({
      id: m.team.id,
      name: m.team.name,
      role: m.role,
      members: m.team.members.map((tm) => ({
        id: tm.id,
        userId: tm.userId,
        role: tm.role,
        user: tm.user,
      })),
    }));
  } catch (error) {
    console.error("Get proposable teams error:", error);
    return [];
  }
}

/**
 * Respond to a task proposal (ACCEPT or DECLINE) (FR-18)
 */
export async function respondToProposal(rawInput: RespondProposalInput) {
  try {
    const userId = await getAuthUserId();
    const validated = respondProposalSchema.parse(rawInput);

    const proposal = await db.taskProposal.findUnique({
      where: { id: validated.proposalId },
      include: {
        team: { select: { name: true } },
        recipient: { select: { name: true, email: true } },
      },
    });

    if (!proposal) {
      return { success: false, error: "Task proposal not found." };
    }

    if (proposal.recipientId !== userId) {
      return { success: false, error: "Unauthorized. You are not the recipient of this proposal." };
    }

    if (proposal.status !== ProposalStatus.PENDING) {
      return { success: false, error: `This proposal has already been ${proposal.status.toLowerCase()}.` };
    }

    if (new Date() > proposal.expiresAt) {
      await db.taskProposal.update({
        where: { id: proposal.id },
        data: { status: ProposalStatus.EXPIRED },
      });
      return { success: false, error: "This proposal has expired." };
    }

    if (validated.decision === "DECLINE") {
      await db.$transaction(async (tx) => {
        await tx.taskProposal.update({
          where: { id: proposal.id },
          data: {
            status: ProposalStatus.DECLINED,
            message: validated.message?.trim() || proposal.message,
          },
        });

        // Notify proposer
        await tx.notification.create({
          data: {
            userId: proposal.proposerId,
            type: "TASK_PROPOSAL",
            title: `Proposal Declined: ${proposal.title}`,
            message: `${proposal.recipient.name || proposal.recipient.email} declined the proposal. ${
              validated.message ? `Reason: "${validated.message}"` : ""
            }`,
            link: "/inbox",
          },
        });
      });

      revalidatePath("/inbox");
      return { success: true, message: "Proposal declined." };
    }

    // ACCEPT Decision: Create Task and schedule on recipient's calendar (FR-18)
    const result = await db.$transaction(async (tx) => {
      // 1. Create the accepted Task assigned to the recipient
      const task = await tx.task.create({
        data: {
          title: proposal.title,
          date: proposal.date,
          startTime: proposal.startTime,
          endTime: proposal.endTime,
          description: proposal.description,
          priority: proposal.priority,
          location: proposal.location,
          color: proposal.color,
          teamId: proposal.teamId,
          createdById: proposal.proposerId,
          assigneeId: proposal.recipientId, // Assigned to recipient
          assignees: {
            create: [{ userId: proposal.recipientId }],
          },
          sourceProposalId: proposal.id, // Keeps link back to proposal (FR-18)
          status: TaskStatus.TODO,
        },
      });

      // 2. Mark proposal ACCEPTED
      await tx.taskProposal.update({
        where: { id: proposal.id },
        data: {
          status: ProposalStatus.ACCEPTED,
          resultingTaskId: task.id,
        },
      });

      // 3. Notify proposer
      await tx.notification.create({
        data: {
          userId: proposal.proposerId,
          type: "TASK_PROPOSAL",
          title: `Proposal Accepted: ${proposal.title}`,
          message: `${proposal.recipient.name || proposal.recipient.email} accepted your proposal and it is now scheduled on their calendar!`,
          link: "/calendar",
        },
      });

      return task;
    });

    // Schedule reminder jobs for recipient's calendar (FR-18, FR-24)
    await syncTaskReminderJobs(result.id);

    revalidatePath("/inbox");
    revalidatePath("/calendar");
    revalidatePath("/tasks");

    return {
      success: true,
      taskId: result.id,
      message: "Proposal accepted! The task is now scheduled on your calendar.",
    };
  } catch (error: unknown) {
    console.error("Respond proposal error:", error);
    const message = error instanceof Error ? error.message : "Failed to respond to proposal";
    return { success: false, error: message };
  }
}

/**
 * Cancel a pending proposal (proposer only) (FR-17)
 */
export async function cancelTaskProposal(proposalId: string) {
  try {
    const userId = await getAuthUserId();

    const proposal = await db.taskProposal.findUnique({
      where: { id: proposalId },
    });

    if (!proposal || proposal.proposerId !== userId) {
      return { success: false, error: "Proposal not found or unauthorized." };
    }

    if (proposal.status !== ProposalStatus.PENDING) {
      return { success: false, error: "Only pending proposals can be cancelled." };
    }

    await db.taskProposal.update({
      where: { id: proposalId },
      data: { status: ProposalStatus.CANCELLED },
    });

    revalidatePath("/inbox");
    return { success: true };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to cancel proposal";
    return { success: false, error: message };
  }
}

/**
 * Fetch all items for the user's Inbox (FR-28)
 */
export async function getInboxData() {
  try {
    const userId = await getAuthUserId();
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });

    const now = new Date();

    const [receivedProposals, sentProposals, pendingInvitations, notifications] = await Promise.all([
      // 1. Pending Proposals Received (FR-18, FR-28)
      db.taskProposal.findMany({
        where: {
          recipientId: userId,
          status: ProposalStatus.PENDING,
          expiresAt: { gt: now },
        },
        include: {
          team: { select: { id: true, name: true } },
          proposer: { select: { id: true, name: true, email: true } },
        },
        orderBy: { createdAt: "desc" },
      }),

      // 2. Proposals Sent by User
      db.taskProposal.findMany({
        where: {
          proposerId: userId,
        },
        include: {
          team: { select: { id: true, name: true } },
          recipient: { select: { id: true, name: true, email: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),

      // 3. Approved Invitations for User's email
      user?.email
        ? db.teamInvitation.findMany({
            where: {
              email: user.email.toLowerCase(),
              status: InvitationStatus.APPROVED,
              expiresAt: { gt: now },
            },
            include: {
              team: { select: { id: true, name: true } },
              invitedBy: { select: { name: true, email: true } },
            },
            orderBy: { createdAt: "desc" },
          })
        : [],

      // 4. In-app notifications
      db.notification.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: 30,
      }),
    ]);

    return {
      receivedProposals: receivedProposals.map((p) => ({
        ...p,
        dateString: toDateString(p.date),
      })),
      sentProposals: sentProposals.map((p) => ({
        ...p,
        dateString: toDateString(p.date),
      })),
      pendingInvitations,
      notifications,
    };
  } catch (error) {
    console.error("Failed to fetch inbox data:", error);
    return {
      receivedProposals: [],
      sentProposals: [],
      pendingInvitations: [],
      notifications: [],
    };
  }
}

/**
 * Mark notification as read
 */
export async function markNotificationRead(notificationId: string) {
  try {
    const userId = await getAuthUserId();
    await db.notification.updateMany({
      where: { id: notificationId, userId },
      data: { read: true },
    });
    revalidatePath("/inbox");
    return { success: true };
  } catch {
    return { success: false };
  }
}
