import { Role } from "@prisma/client";

export type PermissionAction =
  | "VIEW_TEAM"
  | "CREATE_TEAM_TASK"
  | "EDIT_ANY_TEAM_TASK"
  | "EDIT_OWN_TEAM_TASK"
  | "PROPOSE_TASK"
  | "RESPOND_PROPOSAL"
  | "SEND_INVITATION"
  | "APPROVE_INVITATION"
  | "ASSIGN_ROLE"
  | "REMOVE_MEMBER"
  | "MANAGE_TEAM"
  | "LEAVE_TEAM"
  | "MANAGE_TEAM_PENALTIES";

interface PermissionContext {
  isTaskOwner?: boolean;
}

/**
 * Single Source of Truth Permission Engine (Section 6 Matrix)
 *
 * | Action (within one team)               | OWNER | ADMIN | MEMBER | GUEST |
 * | View team calendar, tasks, member list|   ✔   |   ✔   |   ✔    |   ✔   |
 * | Create a team task for self           |   ✔   |   ✔   |   ✔    |   ✖   |
 * | Edit or delete any team task          |   ✔   |   ✔   | own    |   ✖   |
 * | Propose a task to another member      |   ✔   |   ✔   |   ✔    |   ✖   |
 * | Accept or decline proposals sent      |   ✔   |   ✔   |   ✔    |   ✖   |
 * | Send an invitation                    |   ✔   |   ✔   |   ✖    |   ✖   |
 * | Approve or reject invitations         |   ✔   |   ✖   |   ✖    |   ✖   |
 * | Assign or change roles                |   ✔   |   ✖   |   ✖    |   ✖   |
 * | Remove a member or guest              |   ✔   |   ✖   |   ✖    |   ✖   |
 * | Rename, delete team, transfer owner   |   ✔   |   ✖   |   ✖    |   ✖   |
 * | Leave the team                        |   ✖   |   ✔   |   ✔    |   ✔   |
 */
export function can(
  role: Role | null | undefined,
  action: PermissionAction,
  context?: PermissionContext
): boolean {
  if (!role) return false;

  switch (action) {
    case "VIEW_TEAM":
      // All four roles can view team calendar, tasks, and member list
      return true;

    case "CREATE_TEAM_TASK":
      // OWNER, ADMIN, MEMBER can create team tasks for self; GUEST cannot
      return role === Role.OWNER || role === Role.ADMIN || role === Role.MEMBER;

    case "EDIT_ANY_TEAM_TASK":
      // OWNER and ADMIN can edit/delete any team task
      return role === Role.OWNER || role === Role.ADMIN;

    case "EDIT_OWN_TEAM_TASK":
      // OWNER and ADMIN can edit any task; MEMBER can edit own only; GUEST cannot
      if (role === Role.OWNER || role === Role.ADMIN) return true;
      if (role === Role.MEMBER) return !!context?.isTaskOwner;
      return false;

    case "PROPOSE_TASK":
    case "RESPOND_PROPOSAL":
      // OWNER, ADMIN, MEMBER can propose and respond to task proposals; GUEST cannot
      return role === Role.OWNER || role === Role.ADMIN || role === Role.MEMBER;

    case "SEND_INVITATION":
      // OWNER can invite (auto-approved), ADMIN can invite (needs approval); others cannot
      return role === Role.OWNER || role === Role.ADMIN;

    case "APPROVE_INVITATION":
    case "ASSIGN_ROLE":
    case "REMOVE_MEMBER":
    case "MANAGE_TEAM":
      // Strictly Master Admin (OWNER) only
      return role === Role.OWNER;

    case "LEAVE_TEAM":
      // ADMIN, MEMBER, GUEST can leave freely; OWNER must transfer ownership first
      return role === Role.ADMIN || role === Role.MEMBER || role === Role.GUEST;

    case "MANAGE_TEAM_PENALTIES":
      // Strictly Master Admin (OWNER) and Admin (ADMIN) only
      return role === Role.OWNER || role === Role.ADMIN;

    default:
      return false;
  }
}
