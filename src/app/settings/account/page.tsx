"use client";

import { useState, useEffect } from "react";
import { useSession, signOut } from "next-auth/react";
import { User, Mail, Globe, Trash2, AlertTriangle, CheckCircle, Sun, Moon, Laptop, Palette, X } from "lucide-react";
import { ReminderSettingsForm } from "@/components/settings/reminder-settings-form";
import { getReminderPreferences } from "@/actions/reminder-actions";
import { useTheme } from "@/components/providers/theme-provider";

function AppearanceSettingsCard() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4 shadow-xs">
      <div className="flex items-center gap-2">
        <Palette className="h-5 w-5 text-blue-600 dark:text-blue-400" />
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">
          Appearance & Theme
        </h2>
      </div>
      <p className="text-sm text-slate-600 dark:text-slate-400">
        Choose how TheWork STUDIO looks to you. Select a light or dark theme, or sync with your system preferences.
      </p>

      <div className="grid grid-cols-3 gap-3 pt-2">
        <button
          type="button"
          onClick={() => setTheme("light")}
          className={`flex flex-col items-center justify-center p-3.5 rounded-xl border transition ${
            theme === "light"
              ? "border-blue-600 bg-blue-50/50 dark:bg-blue-950/40 text-blue-600 font-semibold shadow-xs"
              : "border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 text-slate-700 dark:text-slate-300 hover:border-slate-300"
          }`}
        >
          <Sun className="h-5 w-5 mb-1.5 text-amber-500" />
          <span className="text-xs">Light</span>
        </button>

        <button
          type="button"
          onClick={() => setTheme("dark")}
          className={`flex flex-col items-center justify-center p-3.5 rounded-xl border transition ${
            theme === "dark"
              ? "border-blue-600 bg-blue-50/50 dark:bg-blue-950/40 text-blue-400 font-semibold shadow-xs"
              : "border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 text-slate-700 dark:text-slate-300 hover:border-slate-300"
          }`}
        >
          <Moon className="h-5 w-5 mb-1.5 text-blue-400" />
          <span className="text-xs">Dark</span>
        </button>

        <button
          type="button"
          onClick={() => setTheme("system")}
          className={`flex flex-col items-center justify-center p-3.5 rounded-xl border transition ${
            theme === "system"
              ? "border-blue-600 bg-blue-50/50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 font-semibold shadow-xs"
              : "border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 text-slate-700 dark:text-slate-300 hover:border-slate-300"
          }`}
        >
          <Laptop className="h-5 w-5 mb-1.5 text-slate-500" />
          <span className="text-xs">System</span>
        </button>
      </div>
    </div>
  );
}

export default function AccountSettingsPage() {
  const { data: session, update } = useSession();

  const [timeZone, setTimeZone] = useState(session?.user?.timeZone || "UTC");
  const [savingTz, setSavingTz] = useState(false);
  const [tzMessage, setTzMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [confirmDeleteText, setConfirmDeleteText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const [reminderPrefs, setReminderPrefs] = useState<{
    enabled: boolean;
    defaultOffsets: number[];
  }>({ enabled: true, defaultOffsets: [4320, 1440, 0] });

  useEffect(() => {
    async function loadReminderPrefs() {
      const prefs = await getReminderPreferences();
      setReminderPrefs(prefs);
    }
    loadReminderPrefs();
  }, []);

  const handleUpdateTz = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingTz(true);
    setTzMessage(null);

    try {
      const res = await fetch("/api/user/timezone", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ timeZone }),
      });

      const data = await res.json();
      if (!res.ok) {
        setTzMessage({ type: "error", text: data.error || "Failed to update timezone" });
      } else {
        await update({ timeZone });
        setTzMessage({ type: "success", text: "Timezone updated successfully" });
      }
    } catch {
      setTzMessage({ type: "error", text: "Network error updating timezone" });
    } finally {
      setSavingTz(false);
    }
  };

  const handleOpenDeleteModal = () => {
    setConfirmDeleteText("");
    setDeleteError(null);
    setDeleteModalOpen(true);
  };

  const handleCloseDeleteModal = () => {
    if (deleting) return;
    setDeleteModalOpen(false);
    setConfirmDeleteText("");
    setDeleteError(null);
  };

  const handleConfirmDeleteAccount = async () => {
    if (confirmDeleteText.trim().toLowerCase() !== "delete my account") {
      return;
    }

    setDeleting(true);
    setDeleteError(null);

    try {
      const res = await fetch("/api/user/account", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmation: confirmDeleteText.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        setDeleteError(data.error || "Failed to delete account");
        setDeleting(false);
      } else {
        await signOut({ callbackUrl: "/sign-in" });
      }
    } catch {
      setDeleteError("Network error while attempting account deletion");
      setDeleting(false);
    }
  };

  if (!session) {
    return (
      <div className="text-center py-12">
        <p className="text-zinc-500">Please sign in to access settings.</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
          Account Settings
        </h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Manage your profile identity, timezone preferences, and account security.
        </p>
      </div>

      {/* Profile Overview */}
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 space-y-4">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
          <User className="h-5 w-5 text-blue-600" />
          <span>Profile Information</span>
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
          <div>
            <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
              Display Name
            </span>
            <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 mt-1">
              {session.user.name || "Not set"}
            </p>
          </div>
          <div>
            <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider flex items-center gap-1">
              <Mail className="h-3.5 w-3.5" /> Email
            </span>
            <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 mt-1">
              {session.user.email}
            </p>
          </div>
        </div>
      </div>

      {/* Theme / Appearance Settings */}
      <AppearanceSettingsCard />

      {/* Time Zone Settings (FR-02) */}
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 space-y-4">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
              <Globe className="h-5 w-5 text-blue-600" />
              <span>Time Zone Preference</span>
            </h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
              All calendar tasks, proposal times, and email reminder calculations use this IANA time zone.
            </p>
          </div>
        </div>

        {tzMessage && (
          <div
            className={`flex items-center gap-2 rounded-lg p-3 text-sm ${
              tzMessage.type === "success"
                ? "bg-green-50 dark:bg-green-950/40 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-900"
                : "bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-900"
            }`}
          >
            {tzMessage.type === "success" ? (
              <CheckCircle className="h-4 w-4 shrink-0" />
            ) : (
              <AlertTriangle className="h-4 w-4 shrink-0" />
            )}
            <span>{tzMessage.text}</span>
          </div>
        )}

        <form onSubmit={handleUpdateTz} className="flex flex-col sm:flex-row gap-3 pt-2">
          <input
            type="text"
            required
            value={timeZone}
            onChange={(e) => setTimeZone(e.target.value)}
            placeholder="e.g. America/New_York or Asia/Dhaka"
            className="flex-1 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
          />
          <button
            type="submit"
            disabled={savingTz}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition"
          >
            {savingTz ? "Saving..." : "Save Timezone"}
          </button>
        </form>
      </div>

      {/* Email Reminders (FR-24, FR-25) */}
      <ReminderSettingsForm initialPreferences={reminderPrefs} />

      {/* Danger Zone: Account Deletion (FR-01) */}
      <div className="rounded-xl border border-red-200 dark:border-red-900/60 bg-red-50/50 dark:bg-red-950/20 p-6 space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-red-700 dark:text-red-400 flex items-center gap-2">
            <Trash2 className="h-5 w-5" />
            <span>Danger Zone</span>
          </h2>
          <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
            Permanently delete your personal tasks, private notes, and account data. If you are the Master Admin of any team, you must transfer ownership or delete the team before deleting your account.
          </p>
        </div>

        {deleteError && (
          <div className="flex items-center gap-2 rounded-lg bg-red-100 dark:bg-red-900/50 p-3 text-sm text-red-800 dark:text-red-200 border border-red-300 dark:border-red-800">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>{deleteError}</span>
          </div>
        )}

        <button
          type="button"
          onClick={handleOpenDeleteModal}
          className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 transition"
        >
          Delete Account
        </button>
      </div>

      {/* Delete Account Confirmation Modal */}
      {deleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800">
              <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
                <AlertTriangle className="h-5 w-5" />
                <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                  Delete Account
                </h2>
              </div>
              <button
                type="button"
                onClick={handleCloseDeleteModal}
                disabled={deleting}
                className="p-1 rounded text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 disabled:opacity-50"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-2 text-sm text-zinc-600 dark:text-zinc-400">
              <p>
                This action is <strong className="text-red-600 dark:text-red-400">permanent and cannot be undone</strong>. All your personal tasks, private notes, and calendar data will be wiped permanently.
              </p>
              <p className="text-xs text-zinc-500">
                * If you are the Master Admin of any team, you must transfer ownership or delete the team before deleting your account.
              </p>
            </div>

            {deleteError && (
              <div className="flex items-start gap-2 rounded-lg bg-red-50 dark:bg-red-950/40 p-3 text-xs text-red-700 dark:text-red-300 border border-red-200 dark:border-red-900">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{deleteError}</span>
              </div>
            )}

            <div className="space-y-2 pt-1">
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                To confirm deletion, please type <span className="font-mono text-red-600 dark:text-red-400 font-bold select-all">delete my account</span> below:
              </label>
              <input
                type="text"
                autoFocus
                value={confirmDeleteText}
                onChange={(e) => setConfirmDeleteText(e.target.value)}
                placeholder="delete my account"
                disabled={deleting}
                className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 font-mono placeholder:text-zinc-400 focus:border-red-500 focus:ring-1 focus:ring-red-500 focus:outline-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-3">
              <button
                type="button"
                onClick={handleCloseDeleteModal}
                disabled={deleting}
                className="rounded-lg border border-zinc-300 dark:border-zinc-700 px-4 py-2 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteAccount}
                disabled={confirmDeleteText.trim().toLowerCase() !== "delete my account" || deleting}
                className="rounded-lg bg-red-600 px-4 py-2 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-red-500 transition flex items-center gap-1.5"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>{deleting ? "Deleting account..." : "Delete My Account"}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
