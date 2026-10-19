"use client";

import { useState, useEffect } from "react";
import {
  shareNote,
  removeNoteShare,
  getNoteShares,
  getShareableRecipients,
} from "@/actions/note-share-actions";
import { NoteShareTargetType, NotePermission } from "@prisma/client";
import {
  X,
  Share2,
  Users,
  User,
  Shield,
  Trash2,
  Loader2,
  Check,
  AlertCircle,
} from "lucide-react";

interface NoteShareModalProps {
  noteId: string;
  noteTitle: string;
  isOpen: boolean;
  onClose: () => void;
}

export function NoteShareModal({
  noteId,
  noteTitle,
  isOpen,
  onClose,
}: NoteShareModalProps) {
  const [loading, setLoading] = useState(true);
  const [sharing, setSharing] = useState(false);
  const [shares, setShares] = useState<any[]>([]);
  const [recipients, setRecipients] = useState<{
    teams: { id: string; name: string }[];
    users: { id: string; name: string | null; email: string }[];
  }>({ teams: [], users: [] });

  const [targetType, setTargetType] = useState<NoteShareTargetType>(
    NoteShareTargetType.USER
  );
  const [targetId, setTargetId] = useState("");
  const [permission, setPermission] = useState<NotePermission>(
    NotePermission.VIEW
  );
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    async function loadData() {
      setLoading(true);
      setError(null);
      const [sharesRes, recRes] = await Promise.all([
        getNoteShares(noteId),
        getShareableRecipients(),
      ]);
      setShares(sharesRes);
      setRecipients(recRes);

      // Default select first available user or team
      if (targetType === NoteShareTargetType.USER && recRes.users.length > 0) {
        setTargetId(recRes.users[0].id);
      } else if (
        targetType === NoteShareTargetType.TEAM &&
        recRes.teams.length > 0
      ) {
        setTargetId(recRes.teams[0].id);
      }

      setLoading(false);
    }

    loadData();
  }, [isOpen, noteId, targetType]);

  if (!isOpen) return null;

  const handleShare = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetId) {
      setError("Please select a user or team.");
      return;
    }

    setSharing(true);
    setError(null);
    setSuccess(null);

    const res = await shareNote({
      noteId,
      targetType,
      targetId,
      permission,
    });

    if (res.success) {
      setSuccess("Note shared successfully!");
      const updatedShares = await getNoteShares(noteId);
      setShares(updatedShares);
    } else {
      setError(res.error || "Failed to share note");
    }

    setSharing(false);
  };

  const handleRemoveShare = async (shareId: string) => {
    setError(null);
    const res = await removeNoteShare(shareId);
    if (res.success) {
      setShares((prev) => prev.filter((s) => s.id !== shareId));
    } else {
      setError(res.error || "Failed to remove share");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 dark:border-zinc-800">
          <div className="flex items-center gap-2">
            <Share2 className="h-5 w-5 text-blue-600" />
            <div>
              <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                Share Note
              </h2>
              <p className="text-xs text-zinc-500 truncate max-w-sm">
                "{noteTitle || "Untitled Note"}"
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
        <div className="p-6 overflow-y-auto space-y-6">
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

          {/* Form to Share */}
          <form onSubmit={handleShare} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                Share with
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setTargetType(NoteShareTargetType.USER);
                    if (recipients.users.length > 0)
                      setTargetId(recipients.users[0].id);
                  }}
                  className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg border text-xs font-semibold transition ${
                    targetType === NoteShareTargetType.USER
                      ? "border-blue-600 bg-blue-50/60 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300"
                      : "border-zinc-200 dark:border-zinc-800 text-zinc-600 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                  }`}
                >
                  <User className="h-3.5 w-3.5" />
                  <span>Teammate</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setTargetType(NoteShareTargetType.TEAM);
                    if (recipients.teams.length > 0)
                      setTargetId(recipients.teams[0].id);
                  }}
                  className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg border text-xs font-semibold transition ${
                    targetType === NoteShareTargetType.TEAM
                      ? "border-blue-600 bg-blue-50/60 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300"
                      : "border-zinc-200 dark:border-zinc-800 text-zinc-600 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                  }`}
                >
                  <Users className="h-3.5 w-3.5" />
                  <span>Entire Team</span>
                </button>
              </div>
            </div>

            {/* Target Selection Dropdown */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                Select {targetType === NoteShareTargetType.USER ? "Teammate" : "Team"}
              </label>
              {targetType === NoteShareTargetType.USER ? (
                recipients.users.length === 0 ? (
                  <p className="text-xs text-zinc-500 italic">
                    No teammates found. Join or create a team with members first.
                  </p>
                ) : (
                  <select
                    value={targetId}
                    onChange={(e) => setTargetId(e.target.value)}
                    className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    {recipients.users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name ? `${u.name} (${u.email})` : u.email}
                      </option>
                    ))}
                  </select>
                )
              ) : recipients.teams.length === 0 ? (
                <p className="text-xs text-zinc-500 italic">
                  You are not a member of any teams yet.
                </p>
              ) : (
                <select
                  value={targetId}
                  onChange={(e) => setTargetId(e.target.value)}
                  className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  {recipients.teams.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Permission Selector (FR-22) */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                Access Level
              </label>
              <div className="grid grid-cols-2 gap-2">
                <label className="flex items-center gap-2 p-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800 cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800/60">
                  <input
                    type="radio"
                    name="permission"
                    value={NotePermission.VIEW}
                    checked={permission === NotePermission.VIEW}
                    onChange={() => setPermission(NotePermission.VIEW)}
                    className="text-blue-600 focus:ring-blue-500"
                  />
                  <div>
                    <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 block">
                      View Only
                    </span>
                    <span className="text-[11px] text-zinc-500 block">
                      Read note, cannot edit
                    </span>
                  </div>
                </label>

                <label className="flex items-center gap-2 p-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800 cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800/60">
                  <input
                    type="radio"
                    name="permission"
                    value={NotePermission.EDIT}
                    checked={permission === NotePermission.EDIT}
                    onChange={() => setPermission(NotePermission.EDIT)}
                    className="text-blue-600 focus:ring-blue-500"
                  />
                  <div>
                    <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 block">
                      Can Edit
                    </span>
                    <span className="text-[11px] text-zinc-500 block">
                      Collaborative editing
                    </span>
                  </div>
                </label>
              </div>
              <p className="text-[11px] text-zinc-400">
                * Note: Team Guests always receive view-only access regardless of settings.
              </p>
            </div>

            <button
              type="submit"
              disabled={sharing || !targetId}
              className="w-full flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 transition disabled:opacity-50"
            >
              {sharing ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Sharing...</span>
                </>
              ) : (
                <>
                  <Share2 className="h-3.5 w-3.5" />
                  <span>Share Note</span>
                </>
              )}
            </button>
          </form>

          {/* Active Shares List (FR-23) */}
          <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800 space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500">
              Who Has Access ({shares.length})
            </h3>

            {loading ? (
              <div className="py-4 text-center text-xs text-zinc-400">
                Loading access list...
              </div>
            ) : shares.length === 0 ? (
              <div className="py-4 text-center text-xs text-zinc-400 italic">
                This note is private. No other users or teams have access.
              </div>
            ) : (
              <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {shares.map((s) => (
                  <div
                    key={s.id}
                    className="py-2.5 flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-600">
                        {s.targetType === NoteShareTargetType.USER ? (
                          <User className="h-3.5 w-3.5" />
                        ) : (
                          <Users className="h-3.5 w-3.5" />
                        )}
                      </div>
                      <div>
                        <p className="font-semibold text-zinc-900 dark:text-zinc-100">
                          {s.targetName}
                        </p>
                        {s.targetEmail && (
                          <p className="text-[10px] text-zinc-400">
                            {s.targetEmail}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          s.permission === NotePermission.EDIT
                            ? "bg-purple-100 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300"
                            : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400"
                        }`}
                      >
                        {s.permission}
                      </span>
                      <button
                        onClick={() => handleRemoveShare(s.id)}
                        className="p-1 rounded text-zinc-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 transition"
                        title="Revoke access"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
