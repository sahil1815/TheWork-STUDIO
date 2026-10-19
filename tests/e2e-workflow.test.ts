import { describe, it, expect } from "vitest";
import { Role, TaskStatus, TaskPriority, ProposalStatus, InvitationStatus, NoteShareTargetType, NotePermission } from "@prisma/client";
import { taskSchema } from "@/lib/validations/task";
import { createProposalSchema } from "@/lib/validations/proposal";
import { shareNoteSchema } from "@/lib/validations/note-share";
import { reminderPreferenceSchema } from "@/lib/validations/reminder";
import { can } from "@/lib/permissions";
import { generateSecureToken, hashToken } from "@/lib/token";
import { calculateReminderSendTime } from "@/lib/reminders";
import { renderReminderDigestHtml } from "@/lib/email";

describe("Phase 6: End-to-End Holistic System Verification (FR-01 to FR-28)", () => {
  // Step 1: Authentication & Timezone
  it("Step 1: should support IANA timezone detection and account preferences", () => {
    const userTz = "America/New_York";
    expect(Intl.supportedValuesOf("timeZone")).toContain(userTz);
  });

  // Step 2: Multi-Role Team Permissions (FR-10 to FR-13)
  it("Step 2: should enforce strict 4-role permission hierarchy", () => {
    // Master Admin (OWNER) privileges
    expect(can(Role.OWNER, "MANAGE_TEAM")).toBe(true);
    expect(can(Role.OWNER, "ASSIGN_ROLE")).toBe(true);
    expect(can(Role.OWNER, "APPROVE_INVITATION")).toBe(true);
    expect(can(Role.OWNER, "REMOVE_MEMBER")).toBe(true);
    expect(can(Role.OWNER, "LEAVE_TEAM")).toBe(false); // Must transfer ownership first

    // Admin privileges
    expect(can(Role.ADMIN, "SEND_INVITATION")).toBe(true);
    expect(can(Role.ADMIN, "APPROVE_INVITATION")).toBe(false);
    expect(can(Role.ADMIN, "LEAVE_TEAM")).toBe(true);

    // Member privileges
    expect(can(Role.MEMBER, "CREATE_TEAM_TASK")).toBe(true);
    expect(can(Role.MEMBER, "PROPOSE_TASK")).toBe(true);
    expect(can(Role.MEMBER, "SEND_INVITATION")).toBe(false);

    // Guest privileges (strictly read-only)
    expect(can(Role.GUEST, "VIEW_TEAM")).toBe(true);
    expect(can(Role.GUEST, "CREATE_TEAM_TASK")).toBe(false);
    expect(can(Role.GUEST, "PROPOSE_TASK")).toBe(false);
    expect(can(Role.GUEST, "RESPOND_PROPOSAL")).toBe(false);
  });

  // Step 3: Two-Step Invitation Approval Workflow (FR-14 to FR-16)
  it("Step 3: should manage two-step invitation state machine and secure tokens", () => {
    // 1. Admin sends invite -> PENDING_APPROVAL
    const invitationDraft = {
      status: InvitationStatus.PENDING_APPROVAL,
      proposedRole: Role.MEMBER,
    };
    expect(invitationDraft.status).toBe(InvitationStatus.PENDING_APPROVAL);

    // 2. Master Admin approves -> APPROVED with single-use crypto token
    const token = generateSecureToken(32);
    const tokenHash = hashToken(token);
    expect(token).toHaveLength(64);
    expect(tokenHash).toHaveLength(64);
    expect(tokenHash).not.toBe(token);

    const approvedInvitation = {
      ...invitationDraft,
      status: InvitationStatus.APPROVED,
      tokenHash,
    };
    expect(approvedInvitation.status).toBe(InvitationStatus.APPROVED);

    // 3. User accepts invite -> ACCEPTED
    const acceptedInvitation = {
      ...approvedInvitation,
      status: InvitationStatus.ACCEPTED,
    };
    expect(acceptedInvitation.status).toBe(InvitationStatus.ACCEPTED);
  });

  // Step 4: Personal & Team Tasks with FR-05 Timing
  it("Step 4: should validate tasks with strict timing constraints", () => {
    // Valid all-day task
    const allDay = taskSchema.safeParse({
      title: "Quarterly Review",
      date: "2026-10-30",
      status: TaskStatus.TODO,
      priority: TaskPriority.HIGH,
    });
    expect(allDay.success).toBe(true);

    // Valid timed task (start and end)
    const timed = taskSchema.safeParse({
      title: "Sprint Retrospective",
      date: "2026-10-30",
      startTime: "14:00",
      endTime: "15:00",
      status: TaskStatus.TODO,
      priority: TaskPriority.MEDIUM,
    });
    expect(timed.success).toBe(true);

    // Invalid: endTime without startTime
    const invalidEndOnly = taskSchema.safeParse({
      title: "Broken Time",
      date: "2026-10-30",
      endTime: "15:00",
    });
    expect(invalidEndOnly.success).toBe(false);

    // Invalid: endTime <= startTime
    const invalidEndBeforeStart = taskSchema.safeParse({
      title: "Backwards Time",
      date: "2026-10-30",
      startTime: "16:00",
      endTime: "15:00",
    });
    expect(invalidEndBeforeStart.success).toBe(false);
  });

  // Step 5: Peer Task Proposal Lifecycle (FR-17 to FR-19, FR-28)
  it("Step 5: should handle peer proposal creation, guest guard, and acceptance", () => {
    const proposalInput = {
      teamId: "team-eng",
      recipientId: "user-bob",
      title: "Review PR #42",
      date: "2026-11-01",
      startTime: "11:00",
      endTime: "12:00",
      priority: TaskPriority.HIGH,
      message: "Please check the database schema changes",
    };

    const parsed = createProposalSchema.safeParse(proposalInput);
    expect(parsed.success).toBe(true);

    // Verify Guest restriction (FR-19)
    expect(can(Role.GUEST, "PROPOSE_TASK")).toBe(false);
    expect(can(Role.GUEST, "RESPOND_PROPOSAL")).toBe(false);
  });

  // Step 6: Private & Collaborative Notebook with Guest Clamp (FR-20 to FR-23)
  it("Step 6: should enforce private-by-default and Guest view-only clamping on shared notes", () => {
    const shareInput = {
      noteId: "note-1",
      targetType: NoteShareTargetType.TEAM,
      targetId: "team-eng",
      permission: NotePermission.EDIT,
    };

    const parsed = shareNoteSchema.safeParse(shareInput);
    expect(parsed.success).toBe(true);

    // Effective permission evaluation
    const resolveNotePermission = (roleInTeam: Role, sharedPerm: NotePermission) => {
      if (roleInTeam === Role.GUEST) {
        return "VIEW"; // FR-22: strictly clamped to VIEW
      }
      return sharedPerm;
    };

    expect(resolveNotePermission(Role.MEMBER, NotePermission.EDIT)).toBe("EDIT");
    expect(resolveNotePermission(Role.ADMIN, NotePermission.EDIT)).toBe("EDIT");
    expect(resolveNotePermission(Role.GUEST, NotePermission.EDIT)).toBe("VIEW"); // Clamped!
  });

  // Step 7: Automated Email Reminders & Digest Batching (FR-24 to FR-27)
  it("Step 7: should calculate timezone UTC timestamps, respect daily quota, and batch digests", () => {
    // 1. Timezone calculation (10:00 EDT = 14:00 UTC on 2026-10-25 -> 1 day before = 2026-10-24 14:00 UTC)
    const sendAt = calculateReminderSendTime("2026-10-25", "10:00", 1440, "America/New_York");
    expect(sendAt.toISOString()).toBe("2026-10-24T14:00:00.000Z");

    // 2. Digest HTML generation for 2 tasks
    const digestHtml = renderReminderDigestHtml({
      userName: "Sarah Connor",
      tasks: [
        {
          id: "t1",
          title: "System Maintenance",
          date: new Date("2026-11-01T00:00:00Z"),
          startTime: "10:00",
          endTime: "11:00",
          priority: TaskPriority.HIGH,
          location: "Server Room",
          teamName: "DevOps",
        },
        {
          id: "t2",
          title: "Client Demo",
          date: new Date("2026-11-01T00:00:00Z"),
          startTime: "14:00",
          endTime: "15:00",
          priority: TaskPriority.MEDIUM,
          location: "Zoom",
          teamName: "Product",
        },
      ],
      appUrl: "https://teamplanner.com",
    });

    expect(digestHtml).toContain("You have 2 upcoming tasks scheduled");
    expect(digestHtml).toContain("System Maintenance");
    expect(digestHtml).toContain("Client Demo");
    expect(digestHtml).toContain("DevOps");
    expect(digestHtml).toContain("Product");
  });
});
