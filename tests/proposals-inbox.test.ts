import { describe, it, expect } from "vitest";
import {
  createProposalSchema,
  respondProposalSchema,
  cancelProposalSchema,
  batchProposalsSchema,
} from "@/lib/validations/proposal";
import { can } from "@/lib/permissions";
import { Role, ProposalStatus, TaskPriority } from "@prisma/client";
import { addDays, subDays } from "date-fns";

describe("Phase 4: Task Proposals & Inbox Engine (FR-17, FR-18, FR-19, FR-28)", () => {
  describe("Proposal Zod Validation & FR-05 Timing Rules", () => {
    it("should accept valid all-day proposal without times", () => {
      const valid = createProposalSchema.safeParse({
        teamId: "team-123",
        recipientId: "user-456",
        title: "Review Architecture Doc",
        date: "2026-10-25",
        priority: TaskPriority.HIGH,
      });

      expect(valid.success).toBe(true);
      if (valid.success) {
        expect(valid.data.title).toBe("Review Architecture Doc");
        expect(valid.data.priority).toBe(TaskPriority.HIGH);
      }
    });

    it("should accept valid timed proposal with start and end times", () => {
      const valid = createProposalSchema.safeParse({
        teamId: "team-123",
        recipientId: "user-456",
        title: "Team Sync",
        date: "2026-10-25",
        startTime: "10:00",
        endTime: "11:30",
        priority: TaskPriority.MEDIUM,
        location: "Zoom Room A",
        message: "Please prepare updates for Q4",
      });

      expect(valid.success).toBe(true);
    });

    it("should accept valid proposal with start time only", () => {
      const valid = createProposalSchema.safeParse({
        teamId: "team-123",
        recipientId: "user-456",
        title: "Standup Call",
        date: "2026-10-25",
        startTime: "09:00",
      });

      expect(valid.success).toBe(true);
    });

    it("should reject proposal with end time but missing start time (FR-05 timing)", () => {
      const invalid = createProposalSchema.safeParse({
        teamId: "team-123",
        recipientId: "user-456",
        title: "Invalid Timing",
        date: "2026-10-25",
        endTime: "17:00",
      });

      expect(invalid.success).toBe(false);
      if (!invalid.success) {
        expect(invalid.error.issues[0].message).toContain(
          "Start time is required when end time is specified"
        );
      }
    });

    it("should reject proposal where endTime is equal to or before startTime (FR-05 timing)", () => {
      const invalidEqual = createProposalSchema.safeParse({
        teamId: "team-123",
        recipientId: "user-456",
        title: "Equal times",
        date: "2026-10-25",
        startTime: "14:00",
        endTime: "14:00",
      });
      expect(invalidEqual.success).toBe(false);

      const invalidBefore = createProposalSchema.safeParse({
        teamId: "team-123",
        recipientId: "user-456",
        title: "End before start",
        date: "2026-10-25",
        startTime: "15:00",
        endTime: "14:00",
      });
      expect(invalidBefore.success).toBe(false);
    });

    it("should accept proposing multiple tasks on same or different dates to same or different members", () => {
      const batchProposals = [
        {
          teamId: "team-eng",
          recipientId: "user-alice",
          title: "PR Review: Auth Flow",
          date: "2026-10-20",
          startTime: "10:00",
          endTime: "11:00",
          priority: TaskPriority.HIGH,
        },
        {
          teamId: "team-eng",
          recipientId: "user-alice",
          title: "DB Migration Test",
          date: "2026-10-20", // Same date, same member
          startTime: "14:00",
          endTime: "15:00",
          priority: TaskPriority.MEDIUM,
        },
        {
          teamId: "team-eng",
          recipientId: "user-bob", // Different member
          title: "Setup CI Runner",
          date: "2026-10-23", // Different date
          priority: TaskPriority.LOW,
        },
      ];

      const result = batchProposalsSchema.safeParse(batchProposals);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.length).toBe(3);
        expect(result.data[0].recipientId).toBe("user-alice");
        expect(result.data[1].date).toBe("2026-10-20");
        expect(result.data[2].date).toBe("2026-10-23");
        expect(result.data[2].recipientId).toBe("user-bob");
      }
    });

    it("should reject batch proposals if any proposal violates timing rules", () => {
      const invalidBatch = [
        {
          teamId: "team-eng",
          recipientId: "user-alice",
          title: "Valid Proposal",
          date: "2026-10-20",
        },
        {
          teamId: "team-eng",
          recipientId: "user-alice",
          title: "Invalid Proposal",
          date: "2026-10-20",
          startTime: "16:00",
          endTime: "15:00", // Invalid backward timing
        },
      ];

      const result = batchProposalsSchema.safeParse(invalidBatch);
      expect(result.success).toBe(false);
    });
  });

  describe("Proposal Response Validation", () => {
    it("should validate ACCEPT and DECLINE decisions", () => {
      const accept = respondProposalSchema.safeParse({
        proposalId: "prop-1",
        decision: "ACCEPT",
      });
      expect(accept.success).toBe(true);

      const decline = respondProposalSchema.safeParse({
        proposalId: "prop-1",
        decision: "DECLINE",
        message: "Too busy today",
      });
      expect(decline.success).toBe(true);

      const invalid = respondProposalSchema.safeParse({
        proposalId: "prop-1",
        decision: "MAYBE",
      });
      expect(invalid.success).toBe(false);
    });
  });

  describe("Permission & Role Guardrails (FR-19)", () => {
    it("should permit OWNER, ADMIN, and MEMBER to propose tasks", () => {
      expect(can(Role.OWNER, "PROPOSE_TASK")).toBe(true);
      expect(can(Role.ADMIN, "PROPOSE_TASK")).toBe(true);
      expect(can(Role.MEMBER, "PROPOSE_TASK")).toBe(true);
    });

    it("should forbid GUEST from proposing tasks (FR-19)", () => {
      expect(can(Role.GUEST, "PROPOSE_TASK")).toBe(false);
    });

    it("should permit non-guests to respond to proposals and forbid GUEST (FR-19)", () => {
      expect(can(Role.OWNER, "RESPOND_PROPOSAL")).toBe(true);
      expect(can(Role.ADMIN, "RESPOND_PROPOSAL")).toBe(true);
      expect(can(Role.MEMBER, "RESPOND_PROPOSAL")).toBe(true);
      expect(can(Role.GUEST, "RESPOND_PROPOSAL")).toBe(false);
    });
  });

  describe("Proposal Expiry and State Transition Lifecycle (FR-18)", () => {
    const evaluateProposalStatus = (proposal: {
      status: ProposalStatus;
      expiresAt: Date;
    }) => {
      if (proposal.status !== ProposalStatus.PENDING) {
        return proposal.status;
      }
      if (new Date() > proposal.expiresAt) {
        return ProposalStatus.EXPIRED;
      }
      return ProposalStatus.PENDING;
    };

    it("should remain PENDING if not expired", () => {
      const active = {
        status: ProposalStatus.PENDING,
        expiresAt: addDays(new Date(), 7),
      };
      expect(evaluateProposalStatus(active)).toBe(ProposalStatus.PENDING);
    });

    it("should expire proposals when past expiresAt date", () => {
      const expired = {
        status: ProposalStatus.PENDING,
        expiresAt: subDays(new Date(), 1),
      };
      expect(evaluateProposalStatus(expired)).toBe(ProposalStatus.EXPIRED);
    });
  });
});
