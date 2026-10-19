"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  respondToProposal,
  cancelTaskProposal,
  markNotificationRead,
} from "@/actions/proposal-actions";
import { ProposalStatus, TaskPriority } from "@prisma/client";
import { format, formatDistanceToNow } from "date-fns";
import {
  Inbox,
  Send,
  Mail,
  Bell,
  Check,
  X,
  Clock,
  Calendar as CalendarIcon,
  MapPin,
  Flag,
  User,
  Users,
  AlertCircle,
  Loader2,
  ExternalLink,
  MessageSquare,
  CheckCircle2,
} from "lucide-react";

interface InboxViewProps {
  initialData: {
    receivedProposals: any[];
    sentProposals: any[];
    pendingInvitations: any[];
    notifications: any[];
  };
}

export function InboxView({ initialData }: InboxViewProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<
    "received" | "sent" | "invitations" | "notifications"
  >("received");

  const [received, setReceived] = useState(initialData.receivedProposals);
  const [sent, setSent] = useState(initialData.sentProposals);
  const [invitations, setInvitations] = useState(initialData.pendingInvitations);
  const [notifications, setNotifications] = useState(initialData.notifications);

  // Decline Dialog State
  const [declineModalOpen, setDeclineModalOpen] = useState(false);
  const [selectedProposalId, setSelectedProposalId] = useState<string | null>(null);
  const [declineMessage, setDeclineMessage] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Accept Proposal
  const handleAccept = async (proposalId: string) => {
    setActionLoading(proposalId);
    setFeedback(null);

    const res = await respondToProposal({
      proposalId,
      decision: "ACCEPT",
    });

    if (res.success) {
      setFeedback({
        type: "success",
        text: "Proposal accepted! Task has been scheduled on your calendar.",
      });
      setReceived((prev) => prev.filter((p) => p.id !== proposalId));
      router.refresh();
    } else {
      setFeedback({
        type: "error",
        text: res.error || "Failed to accept proposal",
      });
    }

    setActionLoading(null);
  };

  // Open Decline Dialog
  const openDeclineModal = (proposalId: string) => {
    setSelectedProposalId(proposalId);
    setDeclineMessage("");
    setDeclineModalOpen(true);
  };

  // Submit Decline
  const handleDeclineSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProposalId) return;

    setActionLoading(selectedProposalId);
    setFeedback(null);

    const res = await respondToProposal({
      proposalId: selectedProposalId,
      decision: "DECLINE",
      message: declineMessage.trim() || undefined,
    });

    if (res.success) {
      setFeedback({
        type: "success",
        text: "Proposal declined.",
      });
      setReceived((prev) => prev.filter((p) => p.id !== selectedProposalId));
      setDeclineModalOpen(false);
      router.refresh();
    } else {
      setFeedback({
        type: "error",
        text: res.error || "Failed to decline proposal",
      });
    }

    setActionLoading(null);
  };

  // Cancel Proposal (Proposer)
  const handleCancel = async (proposalId: string) => {
    const confirmed = window.confirm("Are you sure you want to cancel this pending proposal?");
    if (!confirmed) return;

    setActionLoading(proposalId);
    const res = await cancelTaskProposal(proposalId);

    if (res.success) {
      setSent((prev) =>
        prev.map((p) =>
          p.id === proposalId ? { ...p, status: ProposalStatus.CANCELLED } : p
        )
      );
      setFeedback({ type: "success", text: "Proposal cancelled." });
    } else {
      setFeedback({ type: "error", text: res.error || "Failed to cancel proposal" });
    }

    setActionLoading(null);
  };

  // Mark notification read
  const handleNotificationClick = async (notifId: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === notifId ? { ...n, read: true } : n))
    );
    await markNotificationRead(notifId);
  };

  const unreadNotifCount = notifications.filter((n) => !n.read).length;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-200 dark:border-zinc-800">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-600 text-white shadow-sm">
            <Inbox className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
              Inbox
            </h1>
            <p className="text-xs text-zinc-500">
              Review received task proposals, track sent requests, team invitations, and notifications.
            </p>
          </div>
        </div>

        {/* Global Action Link to Calendar */}
        <Link
          href="/calendar"
          className="self-start sm:self-center flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition"
        >
          <CalendarIcon className="h-3.5 w-3.5" />
          <span>View Calendar</span>
        </Link>
      </div>

      {/* Global Feedback Banner */}
      {feedback && (
        <div
          className={`flex items-center justify-between p-3 rounded-xl border text-xs font-medium ${
            feedback.type === "success"
              ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900"
              : "bg-red-50 dark:bg-red-950/40 text-red-800 dark:text-red-300 border-red-200 dark:border-red-900"
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === "success" ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            ) : (
              <AlertCircle className="h-4 w-4 text-red-600" />
            )}
            <span>{feedback.text}</span>
          </div>
          <button onClick={() => setFeedback(null)}>
            <X className="h-3.5 w-3.5 opacity-60 hover:opacity-100" />
          </button>
        </div>
      )}

      {/* Navigation Tabs (FR-28) */}
      <div className="flex border-b border-zinc-200 dark:border-zinc-800 gap-6 text-sm font-semibold overflow-x-auto no-scrollbar">
        {/* Tab 1: Received Proposals */}
        <button
          onClick={() => setActiveTab("received")}
          className={`pb-3 transition border-b-2 -mb-px flex items-center gap-2 shrink-0 ${
            activeTab === "received"
              ? "border-purple-600 text-purple-600 dark:text-purple-400"
              : "border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
          }`}
        >
          <Send className="h-4 w-4 rotate-180" />
          <span>Received Proposals</span>
          {received.length > 0 && (
            <span className="h-5 min-w-5 px-1.5 rounded-full bg-purple-600 text-white text-[11px] flex items-center justify-center font-bold">
              {received.length}
            </span>
          )}
        </button>

        {/* Tab 2: Sent Proposals */}
        <button
          onClick={() => setActiveTab("sent")}
          className={`pb-3 transition border-b-2 -mb-px flex items-center gap-2 shrink-0 ${
            activeTab === "sent"
              ? "border-purple-600 text-purple-600 dark:text-purple-400"
              : "border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
          }`}
        >
          <Send className="h-4 w-4" />
          <span>Sent Proposals</span>
          {sent.length > 0 && (
            <span className="text-xs text-zinc-400">({sent.length})</span>
          )}
        </button>

        {/* Tab 3: Team Invitations */}
        <button
          onClick={() => setActiveTab("invitations")}
          className={`pb-3 transition border-b-2 -mb-px flex items-center gap-2 shrink-0 ${
            activeTab === "invitations"
              ? "border-purple-600 text-purple-600 dark:text-purple-400"
              : "border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
          }`}
        >
          <Mail className="h-4 w-4" />
          <span>Team Invites</span>
          {invitations.length > 0 && (
            <span className="h-5 min-w-5 px-1.5 rounded-full bg-blue-600 text-white text-[11px] flex items-center justify-center font-bold">
              {invitations.length}
            </span>
          )}
        </button>

        {/* Tab 4: Notifications */}
        <button
          onClick={() => setActiveTab("notifications")}
          className={`pb-3 transition border-b-2 -mb-px flex items-center gap-2 shrink-0 ${
            activeTab === "notifications"
              ? "border-purple-600 text-purple-600 dark:text-purple-400"
              : "border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
          }`}
        >
          <Bell className="h-4 w-4" />
          <span>Notifications</span>
          {unreadNotifCount > 0 && (
            <span className="h-5 min-w-5 px-1.5 rounded-full bg-amber-500 text-white text-[11px] flex items-center justify-center font-bold">
              {unreadNotifCount}
            </span>
          )}
        </button>
      </div>

      {/* ============================================================== */}
      {/* TAB 1: RECEIVED PROPOSALS (FR-18) */}
      {/* ============================================================== */}
      {activeTab === "received" && (
        <div className="space-y-4">
          {received.length === 0 ? (
            <div className="text-center py-12 border border-zinc-200 dark:border-zinc-800 rounded-2xl bg-white dark:bg-zinc-900 p-8">
              <CheckCircle2 className="h-10 w-10 text-emerald-500 mx-auto mb-3" />
              <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                You're all caught up!
              </h3>
              <p className="text-xs text-zinc-500 mt-1 max-w-sm mx-auto">
                No pending task proposals received from teammates. When someone proposes a task to you, it will appear here.
              </p>
            </div>
          ) : (
            <div className="grid gap-4">
              {received.map((proposal) => {
                const isLoading = actionLoading === proposal.id;

                return (
                  <div
                    key={proposal.id}
                    className="border border-zinc-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-900 p-5 shadow-xs transition hover:shadow-sm"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                      {/* Left: Proposal Details */}
                      <div className="space-y-3 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="px-2.5 py-0.5 rounded-full bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 font-bold text-[11px]">
                            Team: {proposal.team.name}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              proposal.priority === TaskPriority.HIGH
                                ? "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300"
                                : proposal.priority === TaskPriority.MEDIUM
                                ? "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                                : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                            }`}
                          >
                            {proposal.priority}
                          </span>
                          <span className="text-[11px] text-zinc-400">
                            Expires {formatDistanceToNow(new Date(proposal.expiresAt), { addSuffix: true })}
                          </span>
                        </div>

                        <div>
                          <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                            {proposal.title}
                          </h3>
                          <p className="text-xs text-zinc-500 mt-0.5 flex items-center gap-1.5">
                            <User className="h-3.5 w-3.5 text-zinc-400" />
                            <span>
                              Proposed by{" "}
                              <strong className="text-zinc-700 dark:text-zinc-300">
                                {proposal.proposer.name || proposal.proposer.email}
                              </strong>
                            </span>
                          </p>
                        </div>

                        {/* Timing and Location */}
                        <div className="flex flex-wrap items-center gap-4 text-xs text-zinc-600 dark:text-zinc-400">
                          <div className="flex items-center gap-1.5">
                            <CalendarIcon className="h-3.5 w-3.5 text-purple-600" />
                            <span>{format(new Date(proposal.date), "EEE, MMM d, yyyy")}</span>
                          </div>

                          {(proposal.startTime || proposal.endTime) && (
                            <div className="flex items-center gap-1.5">
                              <Clock className="h-3.5 w-3.5 text-purple-600" />
                              <span>
                                {proposal.startTime || "All Day"}
                                {proposal.endTime ? ` – ${proposal.endTime}` : ""}
                              </span>
                            </div>
                          )}

                          {proposal.location && (
                            <div className="flex items-center gap-1.5">
                              <MapPin className="h-3.5 w-3.5 text-zinc-400" />
                              <span>{proposal.location}</span>
                            </div>
                          )}
                        </div>

                        {/* Proposer Note / Message */}
                        {proposal.message && (
                          <div className="p-3 rounded-lg bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-100 dark:border-zinc-800 text-xs text-zinc-700 dark:text-zinc-300">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1 flex items-center gap-1">
                              <MessageSquare className="h-3 w-3" />
                              <span>Message from Proposer:</span>
                            </p>
                            <p className="italic">"{proposal.message}"</p>
                          </div>
                        )}

                        {/* Description */}
                        {proposal.description && (
                          <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed whitespace-pre-wrap">
                            {proposal.description}
                          </p>
                        )}
                      </div>

                      {/* Right: Accept / Decline Action Buttons (FR-18) */}
                      <div className="flex sm:flex-col gap-2 shrink-0 self-end sm:self-center">
                        <button
                          onClick={() => handleAccept(proposal.id)}
                          disabled={isLoading}
                          className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs transition disabled:opacity-50 min-w-[100px]"
                        >
                          {isLoading ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <>
                              <Check className="h-4 w-4" />
                              <span>Accept</span>
                            </>
                          )}
                        </button>

                        <button
                          onClick={() => openDeclineModal(proposal.id)}
                          disabled={isLoading}
                          className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-xs font-semibold transition disabled:opacity-50 min-w-[100px]"
                        >
                          <X className="h-4 w-4 text-red-500" />
                          <span>Decline</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 2: SENT PROPOSALS (FR-17) */}
      {/* ============================================================== */}
      {activeTab === "sent" && (
        <div className="space-y-4">
          {sent.length === 0 ? (
            <div className="text-center py-12 border border-zinc-200 dark:border-zinc-800 rounded-2xl bg-white dark:bg-zinc-900 p-8">
              <Send className="h-10 w-10 text-zinc-400 mx-auto mb-3" />
              <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                No sent proposals
              </h3>
              <p className="text-xs text-zinc-500 mt-1">
                You haven't proposed any tasks to teammates yet. Go to your team dashboard to propose a task!
              </p>
            </div>
          ) : (
            <div className="grid gap-3">
              {sent.map((p) => {
                const isPending = p.status === ProposalStatus.PENDING;
                const isAccepted = p.status === ProposalStatus.ACCEPTED;
                const isDeclined = p.status === ProposalStatus.DECLINED;

                return (
                  <div
                    key={p.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            isAccepted
                              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                              : isPending
                              ? "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                              : isDeclined
                              ? "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300"
                              : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                          }`}
                        >
                          {p.status}
                        </span>
                        <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                          {p.title}
                        </span>
                      </div>

                      <p className="text-xs text-zinc-500">
                        Proposed to{" "}
                        <span className="font-semibold text-zinc-700 dark:text-zinc-300">
                          {p.recipient.name || p.recipient.email}
                        </span>{" "}
                        in team <em>{p.team.name}</em> · {format(new Date(p.date), "MMM d, yyyy")}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      {isPending && (
                        <button
                          onClick={() => handleCancel(p.id)}
                          disabled={actionLoading === p.id}
                          className="px-3 py-1.5 rounded-lg border border-red-200 dark:border-red-900 text-xs font-semibold text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 transition disabled:opacity-50"
                        >
                          {actionLoading === p.id ? "Cancelling..." : "Cancel"}
                        </button>
                      )}
                      {isAccepted && (
                        <Link
                          href="/calendar"
                          className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs font-semibold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 transition"
                        >
                          <span>Scheduled</span>
                          <ExternalLink className="h-3 w-3" />
                        </Link>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 3: TEAM INVITATIONS (FR-15, FR-16) */}
      {/* ============================================================== */}
      {activeTab === "invitations" && (
        <div className="space-y-4">
          {invitations.length === 0 ? (
            <div className="text-center py-12 border border-zinc-200 dark:border-zinc-800 rounded-2xl bg-white dark:bg-zinc-900 p-8">
              <Mail className="h-10 w-10 text-zinc-400 mx-auto mb-3" />
              <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                No pending team invitations
              </h3>
              <p className="text-xs text-zinc-500 mt-1">
                When an approved invitation is issued to your email, it will appear here.
              </p>
            </div>
          ) : (
            <div className="grid gap-3">
              {invitations.map((inv) => (
                <div
                  key={inv.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300 text-[10px] font-bold">
                        Approved Invite
                      </span>
                      <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                        Join team "{inv.team.name}"
                      </h4>
                    </div>
                    <p className="text-xs text-zinc-500">
                      Invited by {inv.invitedBy.name || inv.invitedBy.email} · Role:{" "}
                      <strong>{inv.role}</strong>
                    </p>
                  </div>

                  <Link
                    href={`/invite/${inv.tokenHash}`}
                    className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition"
                  >
                    <span>Accept Invitation</span>
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 4: NOTIFICATIONS FEED (FR-28) */}
      {/* ============================================================== */}
      {activeTab === "notifications" && (
        <div className="space-y-4">
          {notifications.length === 0 ? (
            <div className="text-center py-12 border border-zinc-200 dark:border-zinc-800 rounded-2xl bg-white dark:bg-zinc-900 p-8">
              <Bell className="h-10 w-10 text-zinc-400 mx-auto mb-3" />
              <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                No notifications yet
              </h3>
              <p className="text-xs text-zinc-500 mt-1">
                You will be notified of proposal responses, note shares, and team activities.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-zinc-100 dark:divide-zinc-800 border border-zinc-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-900 overflow-hidden">
              {notifications.map((n) => (
                <div
                  key={n.id}
                  onClick={() => handleNotificationClick(n.id)}
                  className={`p-4 flex items-start justify-between gap-4 transition cursor-pointer ${
                    !n.read
                      ? "bg-purple-50/40 dark:bg-purple-950/20"
                      : "hover:bg-zinc-50 dark:hover:bg-zinc-800/40"
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      {!n.read && (
                        <span className="h-2 w-2 rounded-full bg-purple-600 shrink-0" />
                      )}
                      <p className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                        {n.title}
                      </p>
                      <span className="text-[10px] text-zinc-400">
                        {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                      </span>
                    </div>
                    <p className="text-xs text-zinc-600 dark:text-zinc-400 pl-4">
                      {n.message}
                    </p>
                  </div>

                  {n.link && (
                    <Link
                      href={n.link}
                      className="p-1 rounded text-zinc-400 hover:text-purple-600 transition shrink-0"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Link>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ============================================================== */}
      {/* DECLINE PROPOSAL MODAL */}
      {/* ============================================================== */}
      {declineModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                Decline Task Proposal
              </h3>
              <button
                onClick={() => setDeclineModalOpen(false)}
                className="rounded p-1 text-zinc-400 hover:text-zinc-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="text-xs text-zinc-500">
              Provide an optional explanation or reason to your teammate for declining this proposal.
            </p>

            <form onSubmit={handleDeclineSubmit} className="space-y-4">
              <textarea
                rows={3}
                value={declineMessage}
                onChange={(e) => setDeclineMessage(e.target.value)}
                placeholder="e.g. Schedule conflict with another project deadline..."
                className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 p-2.5 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-red-500 resize-none"
              />

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setDeclineModalOpen(false)}
                  className="rounded-lg border border-zinc-300 dark:border-zinc-700 px-3 py-1.5 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading !== null}
                  className="rounded-lg bg-red-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-red-700 transition disabled:opacity-50"
                >
                  {actionLoading !== null ? "Declining..." : "Decline Proposal"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
