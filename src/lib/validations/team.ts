import { z } from "zod";
import { Role } from "@prisma/client";

export const createTeamSchema = z.object({
  name: z.string().min(1, "Team name is required").max(100, "Team name is too long"),
});

export const updateTeamSchema = z.object({
  name: z.string().min(1, "Team name is required").max(100, "Team name is too long"),
});

export const inviteMemberSchema = z.object({
  email: z.string().email("Invalid email address"),
  proposedRole: z.enum([Role.ADMIN, Role.MEMBER, Role.GUEST]),
});

export const changeRoleSchema = z.object({
  targetUserId: z.string().min(1),
  newRole: z.enum([Role.ADMIN, Role.MEMBER, Role.GUEST]),
});

export const transferOwnershipSchema = z.object({
  newOwnerUserId: z.string().min(1),
});

export type CreateTeamInput = z.infer<typeof createTeamSchema>;
export type UpdateTeamInput = z.infer<typeof updateTeamSchema>;
export type InviteMemberInput = z.infer<typeof inviteMemberSchema>;
export type ChangeRoleInput = z.infer<typeof changeRoleSchema>;
export type TransferOwnershipInput = z.infer<typeof transferOwnershipSchema>;
