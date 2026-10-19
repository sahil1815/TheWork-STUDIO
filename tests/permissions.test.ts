import { describe, it, expect } from "vitest";
import { can, PermissionAction } from "@/lib/permissions";
import { Role } from "@prisma/client";

describe("Phase 3: Permission Matrix Tests (Section 6)", () => {
  describe("Role: OWNER (Master Admin)", () => {
    const role = Role.OWNER;

    it("should allow viewing team, calendar, tasks, and members", () => {
      expect(can(role, "VIEW_TEAM")).toBe(true);
    });

    it("should allow creating team task for self", () => {
      expect(can(role, "CREATE_TEAM_TASK")).toBe(true);
    });

    it("should allow editing or deleting any team task", () => {
      expect(can(role, "EDIT_ANY_TEAM_TASK")).toBe(true);
      expect(can(role, "EDIT_OWN_TEAM_TASK", { isTaskOwner: true })).toBe(true);
      expect(can(role, "EDIT_OWN_TEAM_TASK", { isTaskOwner: false })).toBe(true);
    });

    it("should allow proposing tasks and responding to proposals", () => {
      expect(can(role, "PROPOSE_TASK")).toBe(true);
      expect(can(role, "RESPOND_PROPOSAL")).toBe(true);
    });

    it("should allow sending invitations and approving/rejecting invitations", () => {
      expect(can(role, "SEND_INVITATION")).toBe(true);
      expect(can(role, "APPROVE_INVITATION")).toBe(true);
    });

    it("should allow assigning/changing roles and removing members", () => {
      expect(can(role, "ASSIGN_ROLE")).toBe(true);
      expect(can(role, "REMOVE_MEMBER")).toBe(true);
    });

    it("should allow managing team (renaming, deleting, transferring ownership)", () => {
      expect(can(role, "MANAGE_TEAM")).toBe(true);
    });

    it("should NOT allow leaving the team (must transfer ownership first)", () => {
      expect(can(role, "LEAVE_TEAM")).toBe(false);
    });
  });

  describe("Role: ADMIN", () => {
    const role = Role.ADMIN;

    it("should allow viewing team, calendar, tasks, and members", () => {
      expect(can(role, "VIEW_TEAM")).toBe(true);
    });

    it("should allow creating team tasks and editing any team task", () => {
      expect(can(role, "CREATE_TEAM_TASK")).toBe(true);
      expect(can(role, "EDIT_ANY_TEAM_TASK")).toBe(true);
    });

    it("should allow proposing tasks and responding to proposals", () => {
      expect(can(role, "PROPOSE_TASK")).toBe(true);
      expect(can(role, "RESPOND_PROPOSAL")).toBe(true);
    });

    it("should allow sending invitations (queued for approval)", () => {
      expect(can(role, "SEND_INVITATION")).toBe(true);
    });

    it("should NOT allow approving invitations", () => {
      expect(can(role, "APPROVE_INVITATION")).toBe(false);
    });

    it("should NOT allow assigning roles or removing members", () => {
      expect(can(role, "ASSIGN_ROLE")).toBe(false);
      expect(can(role, "REMOVE_MEMBER")).toBe(false);
    });

    it("should NOT allow managing team (renaming, deleting, transferring)", () => {
      expect(can(role, "MANAGE_TEAM")).toBe(false);
    });

    it("should allow leaving the team", () => {
      expect(can(role, "LEAVE_TEAM")).toBe(true);
    });
  });

  describe("Role: MEMBER", () => {
    const role = Role.MEMBER;

    it("should allow viewing team, calendar, tasks, and members", () => {
      expect(can(role, "VIEW_TEAM")).toBe(true);
    });

    it("should allow creating team tasks for self", () => {
      expect(can(role, "CREATE_TEAM_TASK")).toBe(true);
    });

    it("should allow editing own tasks only, not any task", () => {
      expect(can(role, "EDIT_ANY_TEAM_TASK")).toBe(false);
      expect(can(role, "EDIT_OWN_TEAM_TASK", { isTaskOwner: true })).toBe(true);
      expect(can(role, "EDIT_OWN_TEAM_TASK", { isTaskOwner: false })).toBe(false);
    });

    it("should allow proposing tasks and responding to proposals", () => {
      expect(can(role, "PROPOSE_TASK")).toBe(true);
      expect(can(role, "RESPOND_PROPOSAL")).toBe(true);
    });

    it("should NOT allow sending or approving invitations", () => {
      expect(can(role, "SEND_INVITATION")).toBe(false);
      expect(can(role, "APPROVE_INVITATION")).toBe(false);
    });

    it("should NOT allow assigning roles or removing members", () => {
      expect(can(role, "ASSIGN_ROLE")).toBe(false);
      expect(can(role, "REMOVE_MEMBER")).toBe(false);
    });

    it("should allow leaving the team", () => {
      expect(can(role, "LEAVE_TEAM")).toBe(true);
    });
  });

  describe("Role: GUEST", () => {
    const role = Role.GUEST;

    it("should allow read-only viewing of team calendar, tasks, and members", () => {
      expect(can(role, "VIEW_TEAM")).toBe(true);
    });

    it("should NOT allow creating or editing any tasks", () => {
      expect(can(role, "CREATE_TEAM_TASK")).toBe(false);
      expect(can(role, "EDIT_ANY_TEAM_TASK")).toBe(false);
      expect(can(role, "EDIT_OWN_TEAM_TASK", { isTaskOwner: true })).toBe(false);
    });

    it("should NOT allow proposing or responding to proposals", () => {
      expect(can(role, "PROPOSE_TASK")).toBe(false);
      expect(can(role, "RESPOND_PROPOSAL")).toBe(false);
    });

    it("should NOT allow sending or approving invitations", () => {
      expect(can(role, "SEND_INVITATION")).toBe(false);
      expect(can(role, "APPROVE_INVITATION")).toBe(false);
    });

    it("should allow leaving the team", () => {
      expect(can(role, "LEAVE_TEAM")).toBe(true);
    });
  });
});
