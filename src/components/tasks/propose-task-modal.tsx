"use client";

import { useState, useEffect } from "react";
import { createTaskProposal } from "@/actions/proposal-actions";
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
} from "lucide-react";

interface ProposeTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  teams: Array<{
    id: string;
    name: string;
    role: Role;
    members?: Array<{
      id: string;
      userId: string;
      role: Role;
      user: { id: string; name: string | null; email: string };
    }>;
  }>;
  initialTeamId?: string;
  initialRecipientId?: string;
  currentUserId: string;
}

export function ProposeTaskModal({
  isOpen,
  onClose,
  onSuccess,
  teams,
  initialTeamId,
  initialRecipientId,
  currentUserId,
}: ProposeTaskModalProps) {
  // Filter eligible teams (where user is NOT GUEST FR-19)
  const eligibleTeams = teams.filter((t) => t.role !== Role.GUEST);

  const [selectedTeamId, setSelectedTeamId] = useState<string>(
    initialTeamId || (eligibleTeams.length > 0 ? eligibleTeams[0].id : "")
  );
  const [recipientId, setRecipientId] = useState<string>(initialRecipientId || "");
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [priority, setPriority] = useState<TaskPriority>(TaskPriority.MEDIUM);
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [color, setColor] = useState("#8b5cf6");
  const [message, setMessage] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Active selected team
  const activeTeam = eligibleTeams.find((t) => t.id === selectedTeamId);

  // Eligible recipients: members in activeTeam, not current user, and NOT GUEST (FR-19)
  const eligibleRecipients =
    activeTeam?.members?.filter(
      (m) => m.userId !== currentUserId && m.role !== Role.GUEST
    ) || [];

  // Auto-select recipient if none selected
  useEffect(() => {
    if (initialTeamId) setSelectedTeamId(initialTeamId);
    if (initialRecipientId) setRecipientId(initialRecipientId);
  }, [initialTeamId, initialRecipientId]);

  useEffect(() => {
    if (eligibleRecipients.length > 0 && !eligibleRecipients.some((r) => r.userId === recipientId)) {
      setRecipientId(eligibleRecipients[0].userId);
    }
  }, [selectedTeamId, eligibleRecipients, recipientId]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!selectedTeamId) {
      setError("Please select a team.");
      return;
    }

    if (!recipientId) {
      setError("Please select an eligible teammate to receive the proposal.");
      return;
    }

    if (!title.trim()) {
      setError("Task title is required.");
      return;
    }

    // FR-05 Timing rules
    if (endTime && !startTime) {
      setError("Start time is required when end time is specified.");
      return;
    }

    if (startTime && endTime && endTime <= startTime) {
      setError("End time must be strictly after start time.");
      return;
    }

    setLoading(true);

    const res = await createTaskProposal({
      teamId: selectedTeamId,
      recipientId,
      title: title.trim(),
      date,
      startTime: startTime || undefined,
      endTime: endTime || undefined,
      priority,
      description: description.trim() || undefined,
      location: location.trim() || undefined,
      color,
      message: message.trim() || undefined,
    });

    if (res.success) {
      setSuccess("Task proposal sent! Recipient has been notified.");
      setTimeout(() => {
        onSuccess?.();
        onClose();
      }, 1200);
    } else {
      setError(res.error || "Failed to propose task");
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 dark:border-zinc-800">
          <div className="flex items-center gap-2">
            <Send className="h-5 w-5 text-purple-600" />
            <div>
              <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                Propose a Task
              </h2>
              <p className="text-xs text-zinc-500">
                Propose a scheduled task to a teammate. They can accept or decline in their Inbox.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4">
          {error && (
            <div className="flex items-center gap-2 rounded-lg bg-red-50 dark:bg-red-950/40 p-3 text-xs text-red-700 dark:text-red-300 border border-red-200 dark:border-red-900">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="flex items-center gap-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 p-3 text-xs text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900">
              <Check className="h-4 w-4 shrink-0" />
              <span>{success}</span>
            </div>
          )}

          {eligibleTeams.length === 0 ? (
            <div className="p-4 text-center text-xs text-amber-600 bg-amber-50 dark:bg-amber-950/40 rounded-lg">
              You must be an Owner, Admin, or Member of at least one team to propose tasks. (Guests cannot propose tasks per FR-19).
            </div>
          ) : (
            <>
              {/* Team and Recipient Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                    Team
                  </label>
                  <select
                    value={selectedTeamId}
                    onChange={(e) => setSelectedTeamId(e.target.value)}
                    className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-purple-500"
                  >
                    {eligibleTeams.map((t) => (
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
                    <p className="text-xs text-zinc-500 italic py-2">
                      No eligible teammates in this team.
                    </p>
                  ) : (
                    <select
                      value={recipientId}
                      onChange={(e) => setRecipientId(e.target.value)}
                      className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-purple-500"
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
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Code Review for Auth Module"
                  className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-purple-500"
                />
              </div>

              {/* Date & Time (FR-05 timing validation) */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="flex items-center gap-1 text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                    <CalendarIcon className="h-3.5 w-3.5 text-zinc-500" />
                    <span>Date *</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-2.5 py-1.5 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="flex items-center gap-1 text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                    <Clock className="h-3.5 w-3.5 text-zinc-500" />
                    <span>Start Time</span>
                  </label>
                  <input
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-2.5 py-1.5 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="flex items-center gap-1 text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                    <Clock className="h-3.5 w-3.5 text-zinc-500" />
                    <span>End Time</span>
                  </label>
                  <input
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-2.5 py-1.5 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none"
                  />
                </div>
              </div>

              {/* Priority & Color */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="flex items-center gap-1 text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                    <Flag className="h-3.5 w-3.5 text-zinc-500" />
                    <span>Priority</span>
                  </label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as TaskPriority)}
                    className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-1.5 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none"
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
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="e.g. Zoom / Room 302"
                    className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-1.5 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none"
                  />
                </div>
              </div>

              {/* Personal Note / Message to Recipient (FR-17) */}
              <div className="space-y-1">
                <label className="flex items-center gap-1 text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                  <MessageSquare className="h-3.5 w-3.5 text-zinc-500" />
                  <span>Message to Teammate (Optional)</span>
                </label>
                <textarea
                  rows={2}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Why are you proposing this task? Any context?"
                  className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-1.5 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none resize-none"
                />
              </div>

              {/* Task Description */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                  Task Details & Checklist
                </label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Additional task requirements, links, or notes..."
                  className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-1.5 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none resize-none"
                />
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={loading || !recipientId}
                className="w-full flex items-center justify-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-xs font-semibold text-white hover:bg-purple-700 transition disabled:opacity-50 mt-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Submitting proposal...</span>
                  </>
                ) : (
                  <>
                    <Send className="h-3.5 w-3.5" />
                    <span>Send Task Proposal</span>
                  </>
                )}
              </button>
            </>
          )}
        </form>
      </div>
    </div>
  );
}
