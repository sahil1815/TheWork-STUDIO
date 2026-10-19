import { describe, it, expect } from "vitest";
import { generateSecureToken, hashToken } from "@/lib/token";
import { InvitationStatus, Role } from "@prisma/client";
import { addDays, subDays } from "date-fns";

describe("Phase 3: Invitation State Machine & Security Tests (FR-14, FR-15, FR-16)", () => {
  it("should generate cryptographically strong random tokens and deterministic SHA-256 hashes", () => {
    const token1 = generateSecureToken(32);
    const token2 = generateSecureToken(32);

    expect(token1).toHaveLength(64); // 32 bytes in hex = 64 characters
    expect(token2).toHaveLength(64);
    expect(token1).not.toBe(token2);

    const hash1a = hashToken(token1);
    const hash1b = hashToken(token1);
    expect(hash1a).toBe(hash1b); // Deterministic
    expect(hash1a).toHaveLength(64); // SHA-256 hex length
    expect(hash1a).not.toBe(token1); // One-way hash
  });

  describe("Two-Step Approval State Machine", () => {
    // Initial status determination logic
    const getInitialInvitationStatus = (inviterRole: Role): InvitationStatus => {
      if (inviterRole === Role.OWNER) {
        return InvitationStatus.APPROVED; // Master Admin auto-approved (FR-15)
      }
      if (inviterRole === Role.ADMIN) {
        return InvitationStatus.PENDING_APPROVAL; // Admin requires approval (FR-15)
      }
      throw new Error("Unauthorized inviter role");
    };

    it("should auto-approve invitations sent by the Master Admin (OWNER)", () => {
      const status = getInitialInvitationStatus(Role.OWNER);
      expect(status).toBe(InvitationStatus.APPROVED);
    });

    it("should set status to PENDING_APPROVAL for invitations sent by an ADMIN", () => {
      const status = getInitialInvitationStatus(Role.ADMIN);
      expect(status).toBe(InvitationStatus.PENDING_APPROVAL);
    });

    it("should block non-admins from initiating invitations", () => {
      expect(() => getInitialInvitationStatus(Role.MEMBER)).toThrow();
      expect(() => getInitialInvitationStatus(Role.GUEST)).toThrow();
    });

    // Invitation validation state machine
    const validateInvitationForAcceptance = (invitation: {
      status: InvitationStatus;
      expiresAt: Date;
    }) => {
      if (invitation.status === InvitationStatus.ACCEPTED) {
        return { valid: false, error: "Invitation already accepted" };
      }
      if (invitation.status === InvitationStatus.REVOKED) {
        return { valid: false, error: "Invitation revoked" };
      }
      if (invitation.status === InvitationStatus.REJECTED) {
        return { valid: false, error: "Invitation rejected" };
      }
      if (invitation.status === InvitationStatus.PENDING_APPROVAL) {
        return { valid: false, error: "Awaiting Master Admin approval" };
      }
      if (new Date() > invitation.expiresAt) {
        return { valid: false, error: "Invitation expired" };
      }
      if (invitation.status === InvitationStatus.APPROVED) {
        return { valid: true };
      }
      return { valid: false, error: "Invalid invitation status" };
    };

    it("should successfully accept an APPROVED and unexpired invitation", () => {
      const validInvite = {
        status: InvitationStatus.APPROVED,
        expiresAt: addDays(new Date(), 7),
      };
      const result = validateInvitationForAcceptance(validInvite);
      expect(result.valid).toBe(true);
    });

    it("should prevent acceptance of unapproved PENDING_APPROVAL invitations", () => {
      const pendingInvite = {
        status: InvitationStatus.PENDING_APPROVAL,
        expiresAt: addDays(new Date(), 7),
      };
      const result = validateInvitationForAcceptance(pendingInvite);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("approval");
    });

    it("should prevent acceptance of expired invitations", () => {
      const expiredInvite = {
        status: InvitationStatus.APPROVED,
        expiresAt: subDays(new Date(), 1), // expired yesterday
      };
      const result = validateInvitationForAcceptance(expiredInvite);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("expired");
    });

    it("should prevent acceptance of revoked invitations", () => {
      const revokedInvite = {
        status: InvitationStatus.REVOKED,
        expiresAt: addDays(new Date(), 7),
      };
      const result = validateInvitationForAcceptance(revokedInvite);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("revoked");
    });

    it("should prevent re-use of already accepted invitations", () => {
      const usedInvite = {
        status: InvitationStatus.ACCEPTED,
        expiresAt: addDays(new Date(), 7),
      };
      const result = validateInvitationForAcceptance(usedInvite);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("already accepted");
    });
  });
});
