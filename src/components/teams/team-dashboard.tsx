"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Role, InvitationStatus } from "@prisma/client";
import {
  updateTeamName,
  deleteTeam,
  transferTeamOwnership,
  changeMemberRole,
  removeMember,
  leaveTeam,
  sendTeamInvitation,
  reviewInvitation,
  revokeInvitation,
} from "@/actions/team-actions";
import {
  Users,
  Shield,
  ShieldAlert,
  User,
  Eye,
  Calendar,
  CheckSquare,
  Mail,
  Trash2,
  Settings,
  UserMinus,
  Check,
  X,
  Copy,
  ExternalLink,
  AlertTriangle,
  Send,
} from "lucide-react";
import { ProposeTaskModal } from "@/components/tasks/propose-task-modal";

interface TeamDashboardProps {
  team: any;
  currentUserId: string;
}

export function TeamDashboard({ team, currentUserId }: TeamDashboardProps) {
  const router = useRouter();
  const currentUserRole: Role = team.currentUserRole;
  const isOwner = currentUserRole === Role.OWNER;
  const isAdmin = currentUserRole === Role.ADMIN || isOwner;

  const [activeTab, setActiveTab] = useState<"members" | "invitations" | "settings">("members");

  // Invite Modal State
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<Exclude<Role, "OWNER">>(Role.MEMBER);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteResult, setInviteResult] = useState<{ url?: string; message: string } | null>(null);
  const [proposeModalOpen, setProposeModalOpen] = useState(false);
  const [proposeRecipientId, setProposeRecipientId] = useState<string | undefined>(undefined);

  // Settings State
  const [teamName, setTeamName] = useState(team.name);
  const [savingName, setSavingName] = useState(false);
  const [newOwnerId, setNewOwnerId] = useState("");
  const [transferModalOpen, setTransferModalOpen] = useState(false);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  // Handle Send Invite
  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviteLoading(true);
    setInviteResult(null);

    const res = await sendTeamInvitation(team.id, {
      email: inviteEmail,
      proposedRole: inviteRole,
    });

    if (res.success) {
      if (res.token) {
        const url = `${window.location.origin}/invite/${res.token}`;
        setInviteResult({ url, message: res.message || "Invitation generated!" });
      } else {
        setInviteResult({ message: res.message || "Invitation submitted for Master Admin approval." });
      }
      setInviteEmail("");
      router.refresh();
    } else {
      alert(res.error || "Failed to send invitation");
    }
    setInviteLoading(false);
  };

  // Review Invitation (Approve / Reject)
  const handleReviewInvite = async (invitationId: string, decision: "APPROVE" | "REJECT", finalRole?: Role) => {
    const res = await reviewInvitation(invitationId, decision, finalRole);
    if (res.success) {
      if (res.token) {
        const url = `${window.location.origin}/invite/${res.token}`;
        alert(`Approved! Share this invite link: ${url}`);
      }
      router.refresh();
    } else {
      alert(res.error || "Failed to review invitation");
    }
  };

  // Revoke Invitation
  const handleRevokeInvite = async (invitationId: string) => {
    if (!window.confirm("Are you sure you want to revoke this invitation?")) return;
    const res = await revokeInvitation(invitationId);
    if (res.success) router.refresh();
  };

  // Change Role
  const handleChangeRole = async (targetUserId: string, newRole: Exclude<Role, "OWNER">) => {
    const res = await changeMemberRole(team.id, { targetUserId, newRole });
    if (res.success) router.refresh();
    else alert(res.error || "Failed to change role");
  };

  // Remove Member
  const handleRemoveMember = async (targetUserId: string, name: string) => {
    if (!window.confirm(`Are you sure you want to remove ${name} from this team?`)) return;
    const res = await removeMember(team.id, targetUserId);
    if (res.success) router.refresh();
    else alert(res.error || "Failed to remove member");
  };

  // Leave Team
  const handleLeaveTeam = async () => {
    if (!window.confirm("Are you sure you want to leave this team?")) return;
    const res = await leaveTeam(team.id);
    if (res.success) router.push("/teams");
    else alert(res.error || "Failed to leave team");
  };

  // Transfer Ownership
  const handleTransferOwnership = async () => {
    if (!newOwnerId) return;
    if (!window.confirm("Are you sure? You will be demoted to Admin and transfer full control.")) return;
    const res = await transferTeamOwnership(team.id, { newOwnerUserId: newOwnerId });
    if (res.success) {
      setTransferModalOpen(false);
      router.refresh();
    } else {
      alert(res.error || "Failed to transfer ownership");
    }
  };

  // Rename Team
  const handleRenameTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingName(true);
    const res = await updateTeamName(team.id, { name: teamName });
    if (res.success) router.refresh();
    else alert(res.error || "Failed to rename team");
    setSavingName(false);
  };

  // Delete Team
  const handleDeleteTeam = async () => {
    const confirmed = window.prompt(`Type "${team.name}" to permanently delete this team:`);
    if (confirmed !== team.name) {
      alert("Team name did not match. Deletion cancelled.");
      return;
    }
    const res = await deleteTeam(team.id);
    if (res.success) router.push("/teams");
    else alert(res.error || "Failed to delete team");
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedToken(id);
    setTimeout(() => setCopiedToken(null), 2000);
  };

  const pendingApprovals = team.invitations?.filter((i: any) => i.status === InvitationStatus.PENDING_APPROVAL) || [];
  const approvedInvitations = team.invitations?.filter((i: any) => i.status === InvitationStatus.APPROVED) || [];

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Team Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-600 text-white font-black text-xl shadow-md">
            {team.name.substring(0, 2).toUpperCase()}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
                {team.name}
              </h1>
              <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700">
                {currentUserRole === Role.OWNER ? "Master Admin" : currentUserRole}
              </span>
            </div>
            <p className="text-xs text-zinc-500 mt-1">
              {team.members.length} {team.members.length === 1 ? "member" : "members"}
            </p>
          </div>
        </div>

        {/* Quick Links */}
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/calendar`}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition"
          >
            <Calendar className="h-3.5 w-3.5" />
            <span>Team Calendar</span>
          </Link>
          <Link
            href={`/tasks`}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition"
          >
            <CheckSquare className="h-3.5 w-3.5" />
            <span>Team Tasks</span>
          </Link>

          {currentUserRole !== Role.GUEST && (
            <button
              onClick={() => {
                setProposeRecipientId(undefined);
                setProposeModalOpen(true);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-purple-200 dark:border-purple-800 text-xs font-semibold text-purple-700 dark:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-950/40 transition"
            >
              <Send className="h-3.5 w-3.5" />
              <span>Propose Task</span>
            </button>
          )}

          {!isOwner && (
            <button
              onClick={handleLeaveTeam}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 transition"
            >
              <UserMinus className="h-3.5 w-3.5" />
              <span>Leave Team</span>
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-zinc-200 dark:border-zinc-800 gap-6 text-sm font-semibold">
        <button
          onClick={() => setActiveTab("members")}
          className={`pb-3 transition border-b-2 -mb-px ${
            activeTab === "members"
              ? "border-blue-600 text-blue-600 dark:text-blue-400"
              : "border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
          }`}
        >
          Members ({team.members.length})
        </button>

        {isAdmin && (
          <button
            onClick={() => setActiveTab("invitations")}
            className={`pb-3 transition border-b-2 -mb-px flex items-center gap-1.5 ${
              activeTab === "invitations"
                ? "border-blue-600 text-blue-600 dark:text-blue-400"
                : "border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
            }`}
          >
            <span>Invitations</span>
            {pendingApprovals.length > 0 && isOwner && (
              <span className="h-4 w-4 rounded-full bg-amber-500 text-white text-[10px] flex items-center justify-center font-bold">
                {pendingApprovals.length}
              </span>
            )}
          </button>
        )}

        {isOwner && (
          <button
            onClick={() => setActiveTab("settings")}
            className={`pb-3 transition border-b-2 -mb-px ${
              activeTab === "settings"
                ? "border-blue-600 text-blue-600 dark:text-blue-400"
                : "border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
            }`}
          >
            Settings
          </button>
        )}
      </div>

      {/* TAB 1: MEMBERS */}
      {activeTab === "members" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
              Team Roster
            </h2>
            {isAdmin && (
              <button
                onClick={() => setInviteModalOpen(true)}
                className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 transition"
              >
                <Mail className="h-3.5 w-3.5" />
                <span>Invite New Member</span>
              </button>
            )}
          </div>

          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden shadow-sm divide-y divide-zinc-100 dark:divide-zinc-800">
            {team.members.map((member: any) => {
              const isSelf = member.userId === currentUserId;
              const isMemberOwner = member.role === Role.OWNER;

              return (
                <div
                  key={member.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between p-4 gap-3"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-200 dark:bg-zinc-700 font-bold text-sm text-zinc-800 dark:text-zinc-200">
                      {member.user.name?.[0]?.toUpperCase() || "U"}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-zinc-900 dark:text-zinc-100">
                          {member.user.name || "Anonymous User"}
                        </span>
                        {isSelf && (
                          <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                            You
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-zinc-500">{member.user.email}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 self-end sm:self-center">
                    {/* Propose Task button for eligible members (FR-19) */}
                    {currentUserRole !== Role.GUEST &&
                      member.userId !== currentUserId &&
                      member.role !== Role.GUEST && (
                        <button
                          onClick={() => {
                            setProposeRecipientId(member.userId);
                            setProposeModalOpen(true);
                          }}
                          className="flex items-center gap-1 rounded-lg border border-purple-200 dark:border-purple-800 bg-purple-50/50 dark:bg-purple-950/30 px-2.5 py-1 text-xs font-semibold text-purple-700 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-900/50 transition"
                          title="Propose Task to this teammate"
                        >
                          <Send className="h-3 w-3" />
                          <span className="hidden sm:inline">Propose</span>
                        </button>
                      )}

                    {/* Role selector for Master Admin (FR-11) */}
                    {isOwner && !isMemberOwner ? (
                      <select
                        value={member.role}
                        onChange={(e) => handleChangeRole(member.userId, e.target.value as Exclude<Role, "OWNER">)}
                        className="rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-2.5 py-1 text-xs font-semibold text-zinc-800 dark:text-zinc-200 focus:outline-none"
                      >
                        <option value={Role.ADMIN}>Admin</option>
                        <option value={Role.MEMBER}>Member</option>
                        <option value={Role.GUEST}>Guest</option>
                      </select>
                    ) : (
                      <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
                        {member.role === Role.OWNER ? "Master Admin" : member.role}
                      </span>
                    )}

                    {/* Remove Member button (FR-13) */}
                    {isOwner && !isMemberOwner && (
                      <button
                        onClick={() => handleRemoveMember(member.userId, member.user.name || member.user.email)}
                        className="p-1.5 rounded-lg text-zinc-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 transition"
                        title="Remove Member"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 2: INVITATIONS (TWO-STEP APPROVAL) */}
      {activeTab === "invitations" && isAdmin && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                Team Invitations
              </h2>
              <p className="text-xs text-zinc-500">
                Admins can draft invites; only the Master Admin can approve and dispatch single-use join links.
              </p>
            </div>

            <button
              onClick={() => setInviteModalOpen(true)}
              className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 transition"
            >
              <Mail className="h-3.5 w-3.5" />
              <span>Send Invite</span>
            </button>
          </div>

          {/* Pending Master Admin Approvals */}
          {isOwner && (
            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                <AlertTriangle className="h-4 w-4" />
                <span>Pending Master Admin Approval ({pendingApprovals.length})</span>
              </h3>

              {pendingApprovals.length === 0 ? (
                <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs text-zinc-500">
                  No invitations awaiting approval.
                </div>
              ) : (
                <div className="rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/30 dark:bg-amber-950/20 overflow-hidden divide-y divide-amber-100 dark:divide-amber-900/40">
                  {pendingApprovals.map((invite: any) => (
                    <div
                      key={invite.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between p-4 gap-3"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-zinc-900 dark:text-zinc-100">
                            {invite.email}
                          </span>
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200">
                            Proposed: {invite.proposedRole}
                          </span>
                        </div>
                        <p className="text-xs text-zinc-500 mt-0.5">
                          Invited by {invite.invitedBy.name || invite.invitedBy.email}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleReviewInvite(invite.id, "APPROVE")}
                          className="flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 transition shadow-xs"
                        >
                          <Check className="h-3.5 w-3.5" />
                          <span>Approve & Generate Link</span>
                        </button>
                        <button
                          onClick={() => handleReviewInvite(invite.id, "REJECT")}
                          className="flex items-center gap-1 rounded-lg border border-red-300 dark:border-red-800 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 transition"
                        >
                          <X className="h-3.5 w-3.5" />
                          <span>Reject</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Active Approved Invitations */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500">
              Active Single-Use Invitations ({approvedInvitations.length})
            </h3>

            {approvedInvitations.length === 0 ? (
              <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs text-zinc-500">
                No active approved invitations.
              </div>
            ) : (
              <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden divide-y divide-zinc-100 dark:divide-zinc-800">
                {approvedInvitations.map((invite: any) => (
                  <div
                    key={invite.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between p-4 gap-3"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-zinc-900 dark:text-zinc-100">
                          {invite.email}
                        </span>
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-200">
                          Role: {invite.proposedRole}
                        </span>
                      </div>
                      <p className="text-xs text-zinc-400 mt-0.5">
                        Expires in {Math.max(0, Math.ceil((new Date(invite.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))} days
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      {isOwner && (
                        <button
                          onClick={() => handleRevokeInvite(invite.id)}
                          className="text-xs text-red-500 hover:text-red-700 px-2 py-1 rounded hover:bg-red-50 dark:hover:bg-red-950/30 transition"
                        >
                          Revoke
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: SETTINGS (MASTER ADMIN ONLY) */}
      {activeTab === "settings" && isOwner && (
        <div className="space-y-6">
          {/* Rename Team */}
          <div className="p-6 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 space-y-4">
            <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
              Rename Team
            </h2>
            <form onSubmit={handleRenameTeam} className="flex gap-3 max-w-md">
              <input
                type="text"
                required
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                className="flex-1 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              />
              <button
                type="submit"
                disabled={savingName}
                className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {savingName ? "Saving..." : "Rename"}
              </button>
            </form>
          </div>

          {/* Transfer Ownership (FR-13) */}
          <div className="p-6 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 space-y-4">
            <div>
              <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                Transfer Master Admin Ownership
              </h2>
              <p className="text-xs text-zinc-500 mt-0.5">
                Transfer total control to another team member. You will automatically become an Admin.
              </p>
            </div>

            <div className="flex gap-3 max-w-md">
              <select
                value={newOwnerId}
                onChange={(e) => setNewOwnerId(e.target.value)}
                className="flex-1 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-sm focus:outline-none"
              >
                <option value="">Select a member...</option>
                {team.members
                  .filter((m: any) => m.userId !== currentUserId)
                  .map((m: any) => (
                    <option key={m.userId} value={m.userId}>
                      {m.user.name || m.user.email} ({m.role})
                    </option>
                  ))}
              </select>
              <button
                type="button"
                onClick={handleTransferOwnership}
                disabled={!newOwnerId}
                className="rounded-lg bg-purple-600 px-4 py-2 text-xs font-semibold text-white hover:bg-purple-700 disabled:opacity-50"
              >
                Transfer
              </button>
            </div>
          </div>

          {/* Danger Zone: Delete Team */}
          <div className="p-6 rounded-xl border border-red-200 dark:border-red-900/60 bg-red-50/40 dark:bg-red-950/20 space-y-3">
            <h2 className="text-base font-bold text-red-700 dark:text-red-400">
              Delete Team
            </h2>
            <p className="text-xs text-zinc-600 dark:text-zinc-400">
              Permanently delete this team and remove all associated invitations, team task links, and shared member access.
            </p>
            <button
              onClick={handleDeleteTeam}
              className="rounded-lg bg-red-600 px-4 py-2 text-xs font-semibold text-white hover:bg-red-700 transition"
            >
              Delete Team Permanently
            </button>
          </div>
        </div>
      )}

      {/* Invite Member Modal */}
      {inviteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-zinc-100 dark:border-zinc-800">
              <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                Invite to {team.name}
              </h2>
              <button
                onClick={() => {
                  setInviteModalOpen(false);
                  setInviteResult(null);
                }}
                className="p-1 rounded text-zinc-400 hover:text-zinc-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {inviteResult ? (
              <div className="space-y-4">
                <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/40 p-4 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-200 space-y-2">
                  <p className="font-semibold">{inviteResult.message}</p>
                  {inviteResult.url && (
                    <div className="space-y-1 pt-1">
                      <span className="text-[11px] text-zinc-500">Single-use invite link (valid 7 days):</span>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          readOnly
                          value={inviteResult.url}
                          className="flex-1 font-mono text-xs rounded bg-white dark:bg-zinc-800 p-1.5 border border-zinc-300 dark:border-zinc-700"
                        />
                        <button
                          type="button"
                          onClick={() => copyToClipboard(inviteResult.url!, "modal")}
                          className="rounded bg-blue-600 px-2.5 py-1.5 text-xs text-white hover:bg-blue-700 font-semibold flex items-center gap-1"
                        >
                          {copiedToken === "modal" ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                          <span>{copiedToken === "modal" ? "Copied" : "Copy"}</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex justify-end">
                  <button
                    onClick={() => {
                      setInviteModalOpen(false);
                      setInviteResult(null);
                    }}
                    className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white"
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSendInvite} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider mb-1">
                    Invitee Email *
                  </label>
                  <input
                    type="email"
                    required
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="colleague@example.com"
                    className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider mb-1">
                    Assigned Role
                  </label>
                  <select
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value as Exclude<Role, "OWNER">)}
                    className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-sm focus:outline-none"
                  >
                    <option value={Role.MEMBER}>Member (can propose & create tasks)</option>
                    <option value={Role.ADMIN}>Admin (can manage tasks & send invites)</option>
                    <option value={Role.GUEST}>Guest (read-only view)</option>
                  </select>
                </div>

                {!isOwner && (
                  <p className="text-[11px] text-amber-600 dark:text-amber-400">
                    * Because you are an Admin, this invitation will be queued for Master Admin review before an active link is dispatched.
                  </p>
                )}

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setInviteModalOpen(false)}
                    className="rounded-lg border border-zinc-300 dark:border-zinc-700 px-4 py-2 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={inviteLoading}
                    className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    {inviteLoading ? "Sending..." : isOwner ? "Generate Invitation" : "Submit for Approval"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Propose Task Modal */}
      {proposeModalOpen && (
        <ProposeTaskModal
          isOpen={proposeModalOpen}
          onClose={() => setProposeModalOpen(false)}
          teams={[{ id: team.id, name: team.name, role: currentUserRole, members: team.members }]}
          initialTeamId={team.id}
          initialRecipientId={proposeRecipientId}
          currentUserId={currentUserId}
        />
      )}
    </div>
  );
}
