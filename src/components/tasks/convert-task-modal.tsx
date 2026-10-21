"use client";

import { useState, useEffect } from "react";
import { Users, X, AlertCircle, ArrowRight, Check, Loader2 } from "lucide-react";
import { convertPersonalTaskToTeamTask, getTeamMembers } from "@/actions/task-actions";
import { format, parseISO } from "date-fns";
import { formatTaskTiming } from "@/lib/date-utils";

interface TeamOption {
  id: string;
  name: string;
  role: string;
}

interface TeamMemberOption {
  id: string;
  name: string | null;
  email: string;
  role: string;
}

interface ConvertTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  task: any | null;
  teams: TeamOption[];
  currentUserId?: string;
  onSuccess: (updatedTask: any) => void;
}

export function ConvertTaskModal({
  isOpen,
  onClose,
  task,
  teams,
  currentUserId,
  onSuccess,
}: ConvertTaskModalProps) {
  // Filter out teams where user is GUEST (cannot create team tasks)
  const eligibleTeams = teams.filter((t) => t.role !== "GUEST");

  const [selectedTeamId, setSelectedTeamId] = useState<string>(
    eligibleTeams[0]?.id || ""
  );
  const [selectedAssigneeId, setSelectedAssigneeId] = useState<string>(
    currentUserId || ""
  );
  const [teamMembers, setTeamMembers] = useState<TeamMemberOption[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch team members whenever selected team changes
  useEffect(() => {
    if (!selectedTeamId) return;

    let isMounted = true;
    setLoadingMembers(true);
    setError(null);

    getTeamMembers(selectedTeamId)
      .then((members) => {
        if (!isMounted) return;
        setTeamMembers(members);
        // Default assignee to current user if member of team, otherwise first member
        if (currentUserId && members.some((m) => m.id === currentUserId)) {
          setSelectedAssigneeId(currentUserId);
        } else if (members.length > 0) {
          setSelectedAssigneeId(members[0].id);
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        console.error("Failed to fetch members:", err);
        setError("Failed to load team members");
      })
      .finally(() => {
        if (isMounted) setLoadingMembers(false);
      });

    return () => {
      isMounted = false;
    };
  }, [selectedTeamId, currentUserId]);

  if (!isOpen || !task) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTeamId) {
      setError("Please select a destination team.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const res = await convertPersonalTaskToTeamTask(task.id, {
        teamId: selectedTeamId,
        assigneeId: selectedAssigneeId || undefined,
      });

      if (!res.success) {
        setError(res.error || "Failed to convert task");
        setSubmitting(false);
        return;
      }

      onSuccess(res.task);
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Conversion failed";
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const dateStr = task.dateString || task.date;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in">
      <div className="relative w-full max-w-lg rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 dark:border-zinc-800">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                Convert to Team Task
              </h2>
              <p className="text-xs text-zinc-500">
                Move personal task to a shared team workspace
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Task Info Summary */}
        <div className="p-6 space-y-5">
          <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-800/40 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                Task Details (Preserved)
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300">
                Personal Task
              </span>
            </div>
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              {task.title}
            </h3>
            <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-500">
              {dateStr && (
                <span>
                  Due: {format(parseISO(dateStr), "MMM d, yyyy")}
                </span>
              )}
              <span>•</span>
              <span>{formatTaskTiming(task.startTime, task.endTime)}</span>
              <span>•</span>
              <span className="capitalize">{task.priority} Priority</span>
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 rounded-lg bg-red-50 dark:bg-red-950/50 p-3 text-xs text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {eligibleTeams.length === 0 ? (
            <div className="p-4 rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/60 dark:bg-amber-950/20 text-xs text-amber-800 dark:text-amber-300">
              You are not a member of any teams with task creation permissions. Please join or create a team first.
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Destination Team */}
              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
                  Destination Team <span className="text-red-500">*</span>
                </label>
                <select
                  value={selectedTeamId}
                  onChange={(e) => setSelectedTeamId(e.target.value)}
                  className="w-full rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-800 px-3 py-2 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                >
                  {eligibleTeams.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.role.toLowerCase()})
                    </option>
                  ))}
                </select>
              </div>

              {/* Responsible Member / Assignee */}
              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
                  Responsible Member / Assignee <span className="text-red-500">*</span>
                </label>
                {loadingMembers ? (
                  <div className="flex items-center gap-2 py-2 text-xs text-zinc-400">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Loading team members...</span>
                  </div>
                ) : (
                  <select
                    value={selectedAssigneeId}
                    onChange={(e) => setSelectedAssigneeId(e.target.value)}
                    className="w-full rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-800 px-3 py-2 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    required
                  >
                    {teamMembers.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name || m.email} ({m.role.toLowerCase()})
                        {m.id === currentUserId ? " — You" : ""}
                      </option>
                    ))}
                  </select>
                )}
                <p className="text-[11px] text-zinc-500 mt-1">
                  The responsible member will be notified and accountable for this task.
                </p>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-zinc-100 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={submitting}
                  className="px-4 py-2 rounded-lg text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || loadingMembers || !selectedTeamId}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-indigo-600 text-xs font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50 transition"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span>Converting...</span>
                    </>
                  ) : (
                    <>
                      <span>Convert to Team Task</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
