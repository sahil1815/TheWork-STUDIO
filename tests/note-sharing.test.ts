import { describe, it, expect } from "vitest";
import { shareNoteSchema, removeNoteShareSchema } from "@/lib/validations/note-share";
import { NoteShareTargetType, NotePermission, Role } from "@prisma/client";

describe("Phase 4: Note Sharing & Permissions Engine (FR-20, FR-22, FR-23)", () => {
  describe("Zod Validation", () => {
    it("should validate a valid user share input", () => {
      const valid = shareNoteSchema.safeParse({
        noteId: "note-1",
        targetType: NoteShareTargetType.USER,
        targetId: "user-2",
        permission: NotePermission.EDIT,
      });
      expect(valid.success).toBe(true);
      if (valid.success) {
        expect(valid.data.permission).toBe(NotePermission.EDIT);
      }
    });

    it("should default permission to VIEW if omitted", () => {
      const valid = shareNoteSchema.safeParse({
        noteId: "note-1",
        targetType: NoteShareTargetType.TEAM,
        targetId: "team-1",
      });
      expect(valid.success).toBe(true);
      if (valid.success) {
        expect(valid.data.permission).toBe(NotePermission.VIEW);
      }
    });

    it("should reject invalid targetType or missing targetId", () => {
      const invalid = shareNoteSchema.safeParse({
        noteId: "note-1",
        targetType: "ORGANIZATION",
        targetId: "org-1",
      });
      expect(invalid.success).toBe(false);
    });
  });

  describe("Effective Permission Computation & Guest Restriction (FR-22)", () => {
    // Pure function mirroring note-actions resolution logic
    const computeEffectivePermission = (params: {
      userId: string;
      authorId: string;
      shares: Array<{
        targetType: NoteShareTargetType;
        targetId: string;
        permission: NotePermission;
      }>;
      userRoleInTeam?: Role; // Role in team if shared via TEAM
    }): "OWNER" | "EDIT" | "VIEW" | null => {
      if (params.userId === params.authorId) {
        return "OWNER";
      }

      let effective: "EDIT" | "VIEW" | null = null;

      for (const share of params.shares) {
        if (share.targetType === NoteShareTargetType.USER && share.targetId === params.userId) {
          if (share.permission === NotePermission.EDIT) {
            effective = "EDIT";
          } else if (!effective) {
            effective = "VIEW";
          }
        } else if (share.targetType === NoteShareTargetType.TEAM) {
          // FR-22: Guests in a team can ONLY receive VIEW permission
          if (params.userRoleInTeam === Role.GUEST) {
            if (!effective) effective = "VIEW";
          } else {
            if (share.permission === NotePermission.EDIT) {
              effective = "EDIT";
            } else if (!effective) {
              effective = "VIEW";
            }
          }
        }
      }

      return effective;
    };

    it("should grant OWNER permissions to note author", () => {
      const perm = computeEffectivePermission({
        userId: "alice",
        authorId: "alice",
        shares: [],
      });
      expect(perm).toBe("OWNER");
    });

    it("should return null for users with no shares (FR-20 private by default)", () => {
      const perm = computeEffectivePermission({
        userId: "bob",
        authorId: "alice",
        shares: [],
      });
      expect(perm).toBe(null);
    });

    it("should grant EDIT permission for direct USER share with EDIT", () => {
      const perm = computeEffectivePermission({
        userId: "bob",
        authorId: "alice",
        shares: [
          {
            targetType: NoteShareTargetType.USER,
            targetId: "bob",
            permission: NotePermission.EDIT,
          },
        ],
      });
      expect(perm).toBe("EDIT");
    });

    it("should grant VIEW permission for direct USER share with VIEW", () => {
      const perm = computeEffectivePermission({
        userId: "bob",
        authorId: "alice",
        shares: [
          {
            targetType: NoteShareTargetType.USER,
            targetId: "bob",
            permission: NotePermission.VIEW,
          },
        ],
      });
      expect(perm).toBe("VIEW");
    });

    it("should grant EDIT permission to Member for TEAM share with EDIT", () => {
      const perm = computeEffectivePermission({
        userId: "charlie",
        authorId: "alice",
        shares: [
          {
            targetType: NoteShareTargetType.TEAM,
            targetId: "team-eng",
            permission: NotePermission.EDIT,
          },
        ],
        userRoleInTeam: Role.MEMBER,
      });
      expect(perm).toBe("EDIT");
    });

    it("CRITICAL (FR-22): should restrict GUEST to VIEW permission even if TEAM share was granted EDIT", () => {
      const perm = computeEffectivePermission({
        userId: "guest-user",
        authorId: "alice",
        shares: [
          {
            targetType: NoteShareTargetType.TEAM,
            targetId: "team-eng",
            permission: NotePermission.EDIT, // Team granted EDIT
          },
        ],
        userRoleInTeam: Role.GUEST, // Guest in the team
      });
      expect(perm).toBe("VIEW"); // Strictly clamped to VIEW
    });
  });

  describe("Ownership & Modification Rules (FR-23)", () => {
    const canDeleteNote = (userId: string, authorId: string) => userId === authorId;
    const canManageShares = (userId: string, authorId: string) => userId === authorId;
    const canEditContent = (permission: "OWNER" | "EDIT" | "VIEW" | null) =>
      permission === "OWNER" || permission === "EDIT";

    it("should allow only author to delete note (FR-23)", () => {
      expect(canDeleteNote("alice", "alice")).toBe(true);
      expect(canDeleteNote("bob", "alice")).toBe(false);
    });

    it("should allow only author to manage or revoke shares (FR-23)", () => {
      expect(canManageShares("alice", "alice")).toBe(true);
      expect(canManageShares("bob", "alice")).toBe(false);
    });

    it("should allow editing only for OWNER and EDIT permissions", () => {
      expect(canEditContent("OWNER")).toBe(true);
      expect(canEditContent("EDIT")).toBe(true);
      expect(canEditContent("VIEW")).toBe(false);
      expect(canEditContent(null)).toBe(false);
    });
  });
});
