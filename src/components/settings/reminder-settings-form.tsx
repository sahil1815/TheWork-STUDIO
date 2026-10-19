"use client";

import { useState } from "react";
import { updateReminderPreferences } from "@/actions/reminder-actions";
import { Bell, Check, Loader2, AlertCircle, CheckCircle } from "lucide-react";

interface ReminderSettingsFormProps {
  initialPreferences: {
    enabled: boolean;
    defaultOffsets: number[];
  };
}

export function ReminderSettingsForm({ initialPreferences }: ReminderSettingsFormProps) {
  const [enabled, setEnabled] = useState(initialPreferences.enabled);
  const [offsets, setOffsets] = useState<number[]>(initialPreferences.defaultOffsets);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const toggleOffset = (offset: number) => {
    if (offsets.includes(offset)) {
      if (offsets.length === 1 && enabled) {
        alert("At least one reminder offset is required when reminders are enabled.");
        return;
      }
      setOffsets((prev) => prev.filter((o) => o !== offset));
    } else {
      setOffsets((prev) => [...prev, offset].sort((a, b) => b - a));
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    const res = await updateReminderPreferences({
      enabled,
      defaultOffsets: offsets,
    });

    if (res.success) {
      setMessage({
        type: "success",
        text: "Reminder preferences updated! Active task schedules synced.",
      });
    } else {
      setMessage({
        type: "error",
        text: res.error || "Failed to update reminder preferences",
      });
    }

    setSaving(false);
  };

  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
          <Bell className="h-5 w-5 text-blue-600" />
          <span>Automated Email Reminders (Resend)</span>
        </h2>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
          Configure automated email alerts for upcoming personal and team tasks (FR-24, FR-25).
        </p>
      </div>

      {message && (
        <div
          className={`flex items-center gap-2 rounded-lg p-3 text-sm ${
            message.type === "success"
              ? "bg-green-50 dark:bg-green-950/40 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-900"
              : "bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-900"
          }`}
        >
          {message.type === "success" ? (
            <CheckCircle className="h-4 w-4 shrink-0" />
          ) : (
            <AlertCircle className="h-4 w-4 shrink-0" />
          )}
          <span>{message.text}</span>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-4">
        {/* Enable / Disable Switch */}
        <label className="flex items-center justify-between p-3.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/40 cursor-pointer">
          <div>
            <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 block">
              Email Reminders
            </span>
            <span className="text-xs text-zinc-500 block mt-0.5">
              Receive email digests for upcoming scheduled tasks.
            </span>
          </div>
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className="h-4 w-4 rounded text-blue-600 focus:ring-blue-500"
          />
        </label>

        {/* Offsets Checkboxes (FR-25) */}
        {enabled && (
          <div className="space-y-2 pt-2">
            <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider block">
              Default Delivery Intervals
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <label
                onClick={() => toggleOffset(4320)}
                className={`flex items-start gap-3 p-3 rounded-lg border text-xs cursor-pointer transition select-none ${
                  offsets.includes(4320)
                    ? "border-blue-600 bg-blue-50/50 dark:bg-blue-950/30 text-blue-900 dark:text-blue-100 font-semibold"
                    : "border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50"
                }`}
              >
                <input
                  type="checkbox"
                  checked={offsets.includes(4320)}
                  onChange={() => {}}
                  className="mt-0.5 rounded text-blue-600 focus:ring-blue-500"
                />
                <div>
                  <span className="block font-semibold">3 Days Before</span>
                  <span className="text-[11px] opacity-75">4,320 min prior</span>
                </div>
              </label>

              <label
                onClick={() => toggleOffset(1440)}
                className={`flex items-start gap-3 p-3 rounded-lg border text-xs cursor-pointer transition select-none ${
                  offsets.includes(1440)
                    ? "border-blue-600 bg-blue-50/50 dark:bg-blue-950/30 text-blue-900 dark:text-blue-100 font-semibold"
                    : "border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50"
                }`}
              >
                <input
                  type="checkbox"
                  checked={offsets.includes(1440)}
                  onChange={() => {}}
                  className="mt-0.5 rounded text-blue-600 focus:ring-blue-500"
                />
                <div>
                  <span className="block font-semibold">1 Day Before</span>
                  <span className="text-[11px] opacity-75">1,440 min prior</span>
                </div>
              </label>

              <label
                onClick={() => toggleOffset(0)}
                className={`flex items-start gap-3 p-3 rounded-lg border text-xs cursor-pointer transition select-none ${
                  offsets.includes(0)
                    ? "border-blue-600 bg-blue-50/50 dark:bg-blue-950/30 text-blue-900 dark:text-blue-100 font-semibold"
                    : "border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50"
                }`}
              >
                <input
                  type="checkbox"
                  checked={offsets.includes(0)}
                  onChange={() => {}}
                  className="mt-0.5 rounded text-blue-600 focus:ring-blue-500"
                />
                <div>
                  <span className="block font-semibold">Day of Task</span>
                  <span className="text-[11px] opacity-75">At start time (00:00)</span>
                </div>
              </label>
            </div>

            <p className="text-[11px] text-zinc-400 pt-1">
              * Tasks scheduled at the same time are automatically batched into a single email digest (FR-27).
            </p>
          </div>
        )}

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition"
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Saving...</span>
              </>
            ) : (
              <>
                <Check className="h-4 w-4" />
                <span>Save Preferences</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
