"use client";

import { useState, useEffect } from "react";
import { createBatchTaskProposals, getUserProposableTeams } from "@/actions/proposal-actions";
import { TaskPriority, Role } from "@prisma/client";
import {
  X,
  Send,
  Loader2,
  Calendar as CalendarIcon,
  Clock,
  MapPin,
  Flag,
  Users,
  AlertCircle,
  Check,
  MessageSquare,
  Plus,
  Copy,
  Trash2,
  ChevronDown,
  ChevronUp,
  Tag,
} from "lucide-react";

export interface ProposeTaskDraft {
  id: string;
  teamId: string;
  recipientId: string;
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  priority: TaskPriority;
  location: string;
  color: string;
  message: string;
  description: string;
  isExpanded: boolean;
}

interface TeamMemberUser {
  id: string;
  name: string | null;
  email: string;
}

interface TeamMemberItem {
  id: string;
  userId: string;
  role: Role;
  user: TeamMemberUser;
}

interface TeamOption {
  id: string;
  name: string;
  role: Role;
  members?: TeamMemberItem[];
}

interface ProposeTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  teams: TeamOption[];
  initialTeamId?: string;
  initialRecipientId?: string;
  initialData?: {
    title?: string;
    date?: string;
    startTime?: string;
    endTime?: string;
    teamId?: string;
    description?: string;
    priority?: TaskPriority;
    location?: string;
  };
  currentUserId: string;
}

const COLOR_OPTIONS = [
  { label: "Purple", value: "#8b5cf6" },
  { label: "Blue", value: "#3b82f6" },
  { label: "Emerald", value: "#10b981" },
  { label: "Amber", value: "#f59e0b" },
  { label: "Rose", value: "#f43f5e" },
  { label: "Cyan", value: "#06b6d4" },
];

function createEmptyProposalDraft(
  teamId: string,
  recipientId: string,
  defaultDate?: string
): ProposeTaskDraft {
  return {
    id: Math.random().toString(36).substring(2, 9),
    teamId,
    recipientId,
    title: "",
    date: defaultDate || new Date().toISOString().split("T")[0],
    startTime: "",
    endTime: "",
    priority: TaskPriority.MEDIUM,
    location: "",
    color: "#8b5cf6",
    message: "",
    description: "",
    isExpanded: true,
  };
}

export function ProposeTaskModal({
  isOpen,
  onClose,
  onSuccess,
  teams: initialTeams,
  initialTeamId,
  initialRecipientId,
  initialData,
  currentUserId,
}: ProposeTaskModalProps) {
  // Store all available teams where user is not GUEST
  const [allTeams, setAllTeams] = useState<TeamOption[]>(() =>
    initialTeams.filter((t) => t.role !== Role.GUEST)
  );

  const [proposals, setProposals] = useState<ProposeTaskDraft[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Sync initialTeams if it updates or loads later
  useEffect(() => {
    if (initialTeams && initialTeams.length > 0) {
      setAllTeams((prev) => {
        const map = new Map<string, TeamOption>();
        for (const t of prev) map.set(t.id, t);
        for (const t of initialTeams.filter((t) => t.role !== Role.GUEST)) {
          if (!map.has(t.id) || (t.members && t.members.length > 0)) {
            map.set(t.id, t);
          }
        }
        return Array.from(map.values());
      });
    }
  }, [initialTeams]);

  // Fetch full proposable teams list if user has access to more teams
  useEffect(() => {
    let mounted = true;
    getUserProposableTeams().then((fetched) => {
      if (!mounted || !fetched || fetched.length === 0) return;
      setAllTeams((prev) => {
        const map = new Map<string, TeamOption>();
        // Add props teams first
        for (const t of prev) map.set(t.id, t);
        // Add fetched teams
        for (const t of fetched as TeamOption[]) {
          if (!map.has(t.id) || (t.members && (!map.get(t.id)?.members || map.get(t.id)!.members!.length === 0))) {
            map.set(t.id, t);
          }
        }
        return Array.from(map.values());
      });
    });
    return () => {
      mounted = false;
    };
  }, []);

  // Initialize draft when modal opens
  useEffect(() => {
    if (!isOpen) return;

    const baseTeamId =
      initialData?.teamId || initialTeamId || (allTeams.length > 0 ? allTeams[0].id : "");
    const baseTeam = allTeams.find((t) => t.id === baseTeamId);
    const eligibleMembers =
      baseTeam?.members?.filter(
        (m) => m.userId !== currentUserId && m.role !== Role.GUEST
      ) || [];

    const baseRecipientId =
      initialRecipientId || (eligibleMembers.length > 0 ? eligibleMembers[0].userId : "");

    const firstDraft = createEmptyProposalDraft(
      baseTeamId,
      baseRecipientId,
      initialData?.date || new Date().toISOString().split("T")[0]
    );

    if (initialData?.title) firstDraft.title = initialData.title;
    if (initialData?.startTime) firstDraft.startTime = initialData.startTime;
    if (initialData?.endTime) firstDraft.endTime = initialData.endTime;
    if (initialData?.description) firstDraft.description = initialData.description;
    if (initialData?.priority) firstDraft.priority = initialData.priority;
    if (initialData?.location) firstDraft.location = initialData.location;

    setProposals([firstDraft]);
    setError(null);
    setSuccess(null);
  }, [isOpen, initialTeamId, initialRecipientId, initialData, currentUserId]);

  // Helper to get eligible recipients for a specific team
  const getEligibleRecipientsForTeam = (teamId: string) => {
    const t = allTeams.find((item) => item.id === teamId);
    return (
      t?.members?.filter(
        (m) => m.userId !== currentUserId && m.role !== Role.GUEST
      ) || []
    );
  };

  // Ensure every proposal draft has a valid recipientId once eligible recipients are loaded or teams change
  useEffect(() => {
    if (!isOpen) return;
    setProposals((prev) => {
      let changed = false;
      const updated = prev.map((p) => {
        const recipients = getEligibleRecipientsForTeam(p.teamId);
        if (recipients.length === 0) return p;

        const isCurrentRecipientValid = p.recipientId && recipients.some((r) => r.userId === p.recipientId);
        if (!isCurrentRecipientValid) {
          changed = true;
          return {
            ...p,
            recipientId: recipients[0].userId,
          };
        }
        return p;
      });
      return changed ? updated : prev;
    });
  }, [allTeams, isOpen]);

  // Add another proposal to the batch
  const handleAddProposal = () => {
    const last = proposals[proposals.length - 1];
    const defaultTeamId = last ? last.teamId : allTeams[0]?.id || "";
    const recipients = getEligibleRecipientsForTeam(defaultTeamId);
    const defaultRecipientId =
      recipients.length > 0
        ? (recipients.some((r) => r.userId === last?.recipientId) ? last.recipientId : recipients[0].userId)
        : "";

    const newDraft = createEmptyProposalDraft(
      defaultTeamId,
      defaultRecipientId,
      last ? last.date : undefined
    );
    setProposals((prev) => [...prev, newDraft]);
  };

  // Duplicate an existing proposal
  const handleDuplicateProposal = (index: number) => {
    const source = proposals[index];
    if (!source) return;
    const duplicated: ProposeTaskDraft = {
      ...source,
      id: Math.random().toString(36).substring(2, 9),
      title: source.title ? `${source.title} (Copy)` : "",
      isExpanded: true,
    };
    const next = [...proposals];
    next.splice(index + 1, 0, duplicated);
    setProposals(next);
  };

  // Remove a proposal from batch
  const handleRemoveProposal = (id: string) => {
    if (proposals.length <= 1) return;
    setProposals((prev) => prev.filter((p) => p.id !== id));
  };

  // Update a field on a specific proposal
  const handleUpdateProposalField = <K extends keyof ProposeTaskDraft>(
    id: string,
    field: K,
    value: ProposeTaskDraft[K]
  ) => {
    setProposals((prev) =>
      prev.map((p) => {
        if (p.id !== id) return p;
        if (field === "teamId") {
          // If team changed, update recipient to first eligible recipient in new team
          const newTeamId = value as string;
          const recipients = getEligibleRecipientsForTeam(newTeamId);
          return {
            ...p,
            teamId: newTeamId,
            recipientId: recipients[0]?.userId || "",
          };
        }
        return { ...p, [field]: value };
      })
    );
  };

  // Toggle expand / collapse
  const handleToggleExpand = (id: string) => {
    setProposals((prev) =>
      prev.map((p) => (p.id === id ? { ...p, isExpanded: !p.isExpanded } : p))
    );
  };

  // Expand or collapse all
  const handleSetAllExpanded = (expanded: boolean) => {
    setProposals((prev) => prev.map((p) => ({ ...p, isExpanded: expanded })));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (proposals.length === 0) {
      setError("Please add at least one proposal.");
      return;
    }

    // Client-side validation per proposal
    for (let i = 0; i < proposals.length; i++) {
      const p = proposals[i];
      const num = i + 1;

      if (!p.teamId) {
        setError(`Proposal #${num}: Please select a team.`);
        handleUpdateProposalField(p.id, "isExpanded", true);
        return;
      }

      const eligible = getEligibleRecipientsForTeam(p.teamId);
      const effectiveRecipientId =
        p.recipientId && eligible.some((m) => m.userId === p.recipientId)
          ? p.recipientId
          : eligible[0]?.userId || "";

      if (!effectiveRecipientId) {
        setError(`Proposal #${num}: Please select an eligible teammate to receive the proposal.`);
        handleUpdateProposalField(p.id, "isExpanded", true);
        return;
      }

      if (!p.title.trim()) {
        setError(`Proposal #${num}: Task title is required.`);
        handleUpdateProposalField(p.id, "isExpanded", true);
        return;
      }

      if (!p.date.trim()) {
        setError(`Proposal #${num}: Date is required.`);
        handleUpdateProposalField(p.id, "isExpanded", true);
        return;
      }

      // FR-05 Timing rules
      if (p.endTime && !p.startTime) {
        setError(`Proposal #${num}: Start time is required when end time is specified.`);
        handleUpdateProposalField(p.id, "isExpanded", true);
        return;
      }

      if (p.startTime && p.endTime && p.endTime <= p.startTime) {
        setError(`Proposal #${num}: End time must be strictly after start time.`);
        handleUpdateProposalField(p.id, "isExpanded", true);
        return;
      }
    }

    setLoading(true);

    const payloads = proposals.map((p) => {
      const eligible = getEligibleRecipientsForTeam(p.teamId);
      const recipientId =
        p.recipientId && eligible.some((m) => m.userId === p.recipientId)
          ? p.recipientId
          : eligible[0]?.userId || "";

      return {
        teamId: p.teamId,
        recipientId,
        title: p.title.trim(),
        date: p.date,
        startTime: p.startTime || undefined,
        endTime: p.endTime || undefined,
        priority: p.priority,
        description: p.description.trim() || undefined,
        location: p.location.trim() || undefined,
        color: p.color,
        message: p.message.trim() || undefined,
      };
    });

    const res = await createBatchTaskProposals(payloads);

    if (res.success) {
      setSuccess(
        proposals.length > 1
          ? `All ${proposals.length} task proposals sent! Recipients have been notified.`
          : "Task proposal sent! Recipient has been notified."
      );
      setTimeout(() => {
        onSuccess?.();
        onClose();
      }, 1200);
    } else {
      setError(res.error || "Failed to propose tasks");
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/50 backdrop-blur-sm animate-in fade-in">
      <div className="relative w-full max-w-2xl max-h-[92vh] flex flex-col rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 dark:border-zinc-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400">
              <Send className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                {proposals.length > 1
                  ? `Propose Tasks (${proposals.length})`
                  : "Propose a Task"}
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Propose scheduled tasks to teammates. They can accept or decline in their Inbox.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4">
          {error && (
            <div className="flex items-center gap-2 rounded-lg bg-red-50 dark:bg-red-950/40 p-3 text-xs sm:text-sm text-red-700 dark:text-red-300 border border-red-200 dark:border-red-900">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="flex items-center gap-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 p-3 text-xs sm:text-sm text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900">
              <Check className="h-4 w-4 shrink-0" />
              <span>{success}</span>
            </div>
          )}

          {allTeams.length === 0 ? (
            <div className="p-4 text-center text-xs text-amber-600 bg-amber-50 dark:bg-amber-950/40 rounded-lg">
              You must be an Owner, Admin, or Member of at least one team to propose tasks. (Guests cannot propose tasks per FR-19).
            </div>
          ) : (
            <div className="space-y-4">
              {/* Batch Actions Toolbar when > 1 proposal */}
              {proposals.length > 1 && (
                <div className="flex items-center justify-between pb-1 text-xs text-zinc-500">
                  <span className="font-semibold text-zinc-700 dark:text-zinc-300">
                    {proposals.length} Proposals in batch
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleSetAllExpanded(true)}
                      className="hover:text-purple-600 dark:hover:text-purple-400 transition"
                    >
                      Expand All
                    </button>
                    <span>|</span>
                    <button
                      type="button"
                      onClick={() => handleSetAllExpanded(false)}
                      className="hover:text-purple-600 dark:hover:text-purple-400 transition"
                    >
                      Collapse All
                    </button>
                  </div>
                </div>
              )}

              {/* Proposal Cards List */}
              <div className="space-y-3">
                {proposals.map((proposal, index) => {
                  const team = allTeams.find((t) => t.id === proposal.teamId);
                  const eligibleRecipients = getEligibleRecipientsForTeam(proposal.teamId);
                  const recipientMember = eligibleRecipients.find(
                    (m) => m.userId === (proposal.recipientId || eligibleRecipients[0]?.userId)
                  );
                  const recipientName = recipientMember?.user?.name || recipientMember?.user?.email || "Teammate";

                  return (
                    <div
                      key={proposal.id}
                      className="border border-zinc-200 dark:border-zinc-800 rounded-xl bg-zinc-50/50 dark:bg-zinc-800/20 overflow-hidden transition-all shadow-xs"
                    >
                      {/* Card Header */}
                      <div
                        onClick={() => handleToggleExpand(proposal.id)}
                        className="flex items-center justify-between px-4 py-3 bg-white dark:bg-zinc-800/60 cursor-pointer select-none hover:bg-zinc-50 dark:hover:bg-zinc-800 transition border-b border-zinc-100 dark:border-zinc-800"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-purple-100 dark:bg-purple-900/60 text-purple-700 dark:text-purple-300 text-xs font-bold">
                            {index + 1}
                          </span>
                          <span
                            className="h-3 w-3 rounded-full shrink-0"
                            style={{ backgroundColor: proposal.color }}
                          />
                          <span className="font-semibold text-sm text-zinc-900 dark:text-zinc-100 truncate max-w-[160px] sm:max-w-[220px]">
                            {proposal.title || `Proposal #${index + 1}`}
                          </span>
                          <span className="hidden sm:inline-flex items-center gap-1 font-mono text-[11px] text-zinc-500 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded">
                            <CalendarIcon className="h-3 w-3" />
                            {proposal.date || "No date"}
                          </span>
                          <span className="hidden md:inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded bg-purple-50 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300">
                            <Users className="h-3 w-3" />
                            To: {recipientName}
                          </span>
                        </div>

                        {/* Card Top Actions */}
                        <div
                          className="flex items-center gap-1 shrink-0"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            onClick={() => handleDuplicateProposal(index)}
                            title="Duplicate this proposal"
                            className="p-1 rounded-md text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700/60 transition"
                          >
                            <Copy className="h-4 w-4" />
                          </button>
                          {proposals.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveProposal(proposal.id)}
                              title="Delete this proposal card"
                              className="p-1 rounded-md text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 transition"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleToggleExpand(proposal.id)}
                            title={proposal.isExpanded ? "Collapse" : "Expand"}
                            className="p-1 rounded-md text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700/60 transition"
                          >
                            {proposal.isExpanded ? (
                              <ChevronUp className="h-4 w-4" />
                            ) : (
                              <ChevronDown className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                      </div>

                      {/* Card Body (Expanded) */}
                      {proposal.isExpanded && (
                        <div className="p-4 space-y-3.5">
                          {/* Team & Recipient */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                                Team
                              </label>
                              <select
                                value={proposal.teamId}
                                onChange={(e) =>
                                  handleUpdateProposalField(
                                    proposal.id,
                                    "teamId",
                                    e.target.value
                                  )
                                }
                                className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-1.5 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-purple-500"
                              >
                                {allTeams.map((t) => (
                                  <option key={t.id} value={t.id}>
                                    {t.name}
                                  </option>
                                ))}
                              </select>
                            </div>

                            <div className="space-y-1">
                              <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                                Propose To
                              </label>
                              {eligibleRecipients.length === 0 ? (
                                <p className="text-xs text-zinc-500 italic py-1.5">
                                  No eligible teammates in this team.
                                </p>
                              ) : (
                                <select
                                  value={
                                    proposal.recipientId ||
                                    (eligibleRecipients.length > 0 ? eligibleRecipients[0].userId : "")
                                  }
                                  onChange={(e) =>
                                    handleUpdateProposalField(
                                      proposal.id,
                                      "recipientId",
                                      e.target.value
                                    )
                                  }
                                  className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-1.5 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-purple-500"
                                >
                                  {eligibleRecipients.map((r) => (
                                    <option key={r.userId} value={r.userId}>
                                      {r.user.name || r.user.email} ({r.role})
                                    </option>
                                  ))}
                                </select>
                              )}
                            </div>
                          </div>

                          {/* Title */}
                          <div className="space-y-1">
                            <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                              Task Title *
                            </label>
                            <input
                              type="text"
                              required
                              value={proposal.title}
                              onChange={(e) =>
                                handleUpdateProposalField(
                                  proposal.id,
                                  "title",
                                  e.target.value
                                )
                              }
                              placeholder="e.g., Code Review for Auth Module"
                              className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-purple-500"
                            />
                          </div>

                          {/* Date & Time */}
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <div className="space-y-1">
                              <label className="flex items-center gap-1 text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                                <CalendarIcon className="h-3.5 w-3.5 text-zinc-500" />
                                <span>Date *</span>
                              </label>
                              <input
                                type="date"
                                required
                                value={proposal.date}
                                onChange={(e) =>
                                  handleUpdateProposalField(
                                    proposal.id,
                                    "date",
                                    e.target.value
                                  )
                                }
                                className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-2.5 py-1.5 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-purple-500"
                              />
                            </div>

                            <div className="space-y-1">
                              <label className="flex items-center gap-1 text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                                <Clock className="h-3.5 w-3.5 text-zinc-500" />
                                <span>Start Time</span>
                              </label>
                              <input
                                type="time"
                                value={proposal.startTime}
                                onChange={(e) =>
                                  handleUpdateProposalField(
                                    proposal.id,
                                    "startTime",
                                    e.target.value
                                  )
                                }
                                className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-2.5 py-1.5 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-purple-500"
                              />
                            </div>

                            <div className="space-y-1">
                              <label className="flex items-center gap-1 text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                                <Clock className="h-3.5 w-3.5 text-zinc-500" />
                                <span>End Time</span>
                              </label>
                              <input
                                type="time"
                                value={proposal.endTime}
                                onChange={(e) =>
                                  handleUpdateProposalField(
                                    proposal.id,
                                    "endTime",
                                    e.target.value
                                  )
                                }
                                className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-2.5 py-1.5 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-purple-500"
                              />
                            </div>
                          </div>

                          {/* Priority, Location & Color */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <label className="flex items-center gap-1 text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                                <Flag className="h-3.5 w-3.5 text-zinc-500" />
                                <span>Priority</span>
                              </label>
                              <select
                                value={proposal.priority}
                                onChange={(e) =>
                                  handleUpdateProposalField(
                                    proposal.id,
                                    "priority",
                                    e.target.value as TaskPriority
                                  )
                                }
                                className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-1.5 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-purple-500"
                              >
                                <option value={TaskPriority.LOW}>Low</option>
                                <option value={TaskPriority.MEDIUM}>Medium</option>
                                <option value={TaskPriority.HIGH}>High</option>
                              </select>
                            </div>

                            <div className="space-y-1">
                              <label className="flex items-center gap-1 text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                                <MapPin className="h-3.5 w-3.5 text-zinc-500" />
                                <span>Location</span>
                              </label>
                              <input
                                type="text"
                                value={proposal.location}
                                onChange={(e) =>
                                  handleUpdateProposalField(
                                    proposal.id,
                                    "location",
                                    e.target.value
                                  )
                                }
                                placeholder="e.g. Zoom / Room 302"
                                className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-1.5 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-purple-500"
                              />
                            </div>
                          </div>

                          {/* Color Label */}
                          <div className="space-y-1">
                            <label className="flex items-center gap-1 text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                              <Tag className="h-3.5 w-3.5 text-zinc-500" />
                              <span>Color Label</span>
                            </label>
                            <div className="flex items-center gap-2 pt-0.5">
                              {COLOR_OPTIONS.map((c) => (
                                <button
                                  key={c.value}
                                  type="button"
                                  onClick={() =>
                                    handleUpdateProposalField(proposal.id, "color", c.value)
                                  }
                                  style={{ backgroundColor: c.value }}
                                  className={`h-6 w-6 rounded-full transition-transform ${
                                    proposal.color === c.value
                                      ? "ring-2 ring-offset-2 ring-purple-600 dark:ring-purple-400 scale-110"
                                      : "opacity-80 hover:opacity-100"
                                  }`}
                                  title={c.label}
                                />
                              ))}
                            </div>
                          </div>

                          {/* Message to Recipient */}
                          <div className="space-y-1">
                            <label className="flex items-center gap-1 text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                              <MessageSquare className="h-3.5 w-3.5 text-zinc-500" />
                              <span>Message to Teammate (Optional)</span>
                            </label>
                            <textarea
                              rows={2}
                              value={proposal.message}
                              onChange={(e) =>
                                handleUpdateProposalField(
                                  proposal.id,
                                  "message",
                                  e.target.value
                                )
                              }
                              placeholder="Why are you proposing this task? Any context?"
                              className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-1.5 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-purple-500 resize-none"
                            />
                          </div>

                          {/* Task Description */}
                          <div className="space-y-1">
                            <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                              Task Details & Checklist
                            </label>
                            <textarea
                              rows={2}
                              value={proposal.description}
                              onChange={(e) =>
                                handleUpdateProposalField(
                                  proposal.id,
                                  "description",
                                  e.target.value
                                )
                              }
                              placeholder="Additional task requirements, links, or notes..."
                              className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-1.5 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-purple-500 resize-none"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Add Another Proposal button */}
              <button
                type="button"
                onClick={handleAddProposal}
                className="w-full flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-zinc-200 dark:border-zinc-800 py-2.5 text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:text-purple-600 dark:hover:text-purple-400 hover:border-purple-300 dark:hover:border-purple-800 hover:bg-purple-50/50 dark:hover:bg-purple-950/20 transition"
              >
                <Plus className="h-4 w-4" />
                <span>Add Another Task to Propose</span>
              </button>
            </div>
          )}

          {/* Action buttons footer */}
          <div className="flex items-center justify-between pt-3 border-t border-zinc-100 dark:border-zinc-800">
            <button
              type="button"
              onClick={handleAddProposal}
              className="hidden sm:flex items-center gap-1 text-xs font-medium text-purple-600 dark:text-purple-400 hover:underline"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>+ Add proposal</span>
            </button>

            <div className="flex items-center gap-2 ml-auto">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-zinc-300 dark:border-zinc-700 px-4 py-2 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || allTeams.length === 0}
                className="flex items-center justify-center gap-1.5 rounded-lg bg-purple-600 px-5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-purple-700 disabled:opacity-50 transition"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Sending...</span>
                  </>
                ) : (
                  <>
                    <Send className="h-3.5 w-3.5" />
                    <span>
                      {proposals.length > 1
                        ? `Send ${proposals.length} Proposals`
                        : "Send Task Proposal"}
                    </span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
