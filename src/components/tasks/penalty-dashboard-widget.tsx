"use client";

import { useState, useEffect } from "react";
import {
  AlertTriangle,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Calendar,
  Clock,
  User,
  Users,
  ChevronLeft,
  ChevronRight,
  History,
  X,
  Info,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import {
  getPenaltySettingsAction,
  updatePenaltySettingsAction,
  getPenaltySummaryAction,
} from "@/actions/task-actions";
import { format, parseISO } from "date-fns";

interface PenaltyDashboardWidgetProps {
  currentUserId?: string;
  onSettingsChanged?: () => void;
  activeSection?: "ALL" | "PERSONAL" | "TEAM";
}

export function PenaltyDashboardWidget({
  currentUserId,
  onSettingsChanged,
  activeSection = "ALL",
}: PenaltyDashboardWidgetProps) {
  const [personalEnabled, setPersonalEnabled] = useState(true);
  const [teamEnabled, setTeamEnabled] = useState(true);
  const [togglingPersonal, setTogglingPersonal] = useState(false);
  const [togglingTeam, setTogglingTeam] = useState(false);

  const [summary, setSummary] = useState<any | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(true);

  // History Modal State
  const [historyOpen, setHistoryOpen] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState<string>("");
  const [historyTypeFilter, setHistoryTypeFilter] = useState<"ALL" | "PERSONAL" | "TEAM">("ALL");
  const [loadingHistory, setLoadingHistory] = useState(false);

  const loadData = async (month?: string) => {
    try {
      const [settingsRes, summaryRes] = await Promise.all([
        getPenaltySettingsAction(),
        getPenaltySummaryAction(month),
      ]);

      if (settingsRes.success && settingsRes.settings) {
        setPersonalEnabled(settingsRes.settings.personalTasksEnabled);
        setTeamEnabled(settingsRes.settings.teamTasksEnabled);
      }

      if (summaryRes.success && summaryRes.summary) {
        setSummary(summaryRes.summary);
        if (!selectedMonth) {
          setSelectedMonth(summaryRes.summary.currentMonthYear);
        }
      }
    } catch (err) {
      console.error("Failed to load penalty overview:", err);
    } finally {
      setLoadingSummary(false);
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleTogglePersonal = async () => {
    setTogglingPersonal(true);
    const nextVal = !personalEnabled;
    setPersonalEnabled(nextVal);
    const res = await updatePenaltySettingsAction({ personalTasksEnabled: nextVal });
    if (!res.success) {
      setPersonalEnabled(!nextVal);
      alert(res.error || "Failed to update setting");
    } else {
      await loadData(selectedMonth);
      onSettingsChanged?.();
    }
    setTogglingPersonal(false);
  };

  const handleToggleTeam = async () => {
    setTogglingTeam(true);
    const nextVal = !teamEnabled;
    setTeamEnabled(nextVal);
    const res = await updatePenaltySettingsAction({ teamTasksEnabled: nextVal });
    if (!res.success) {
      setTeamEnabled(!nextVal);
      alert(res.error || "Failed to update setting");
    } else {
      await loadData(selectedMonth);
      onSettingsChanged?.();
    }
    setTogglingTeam(false);
  };

  const handleMonthChange = async (monthStr: string) => {
    setSelectedMonth(monthStr);
    setLoadingHistory(true);
    const res = await getPenaltySummaryAction(monthStr);
    if (res.success && res.summary) {
      setSummary(res.summary);
    }
    setLoadingHistory(false);
  };

  const formatMonthTitle = (monthYearStr?: string) => {
    if (!monthYearStr) return "";
    try {
      return format(parseISO(`${monthYearStr}-01`), "MMMM yyyy");
    } catch {
      return monthYearStr;
    }
  };

  const currentMonthTitle = formatMonthTitle(summary?.currentMonthYear);
  const selectedMonthTitle = formatMonthTitle(summary?.selectedMonthYear || selectedMonth);

  const penaltiesToDisplay = (summary?.penalties || []).filter((p: any) => {
    if (historyTypeFilter === "PERSONAL") return p.taskType === "PERSONAL";
    if (historyTypeFilter === "TEAM") return p.taskType === "TEAM";
    return true;
  });

  return (
    <div className="space-y-3">
      {/* Overview Banner Card */}
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Left: Monthly Penalty Title & History Trigger */}
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-900/60">
              <ShieldAlert className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                  Monthly Penalty System
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300">
                  {currentMonthTitle || "Current Month"}
                </span>
              </div>
              <p className="text-xs text-zinc-500">
                Track overdue tasks, automated monthly reset, and permanent history records.
              </p>
            </div>
          </div>

          {/* Right: History View Button */}
          <div className="flex items-center gap-2 self-start md:self-center">
            <button
              onClick={() => {
                setSelectedMonth(summary?.currentMonthYear || "");
                loadData(summary?.currentMonthYear);
                setHistoryOpen(true);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-750 transition shadow-2xs"
            >
              <History className="h-3.5 w-3.5 text-zinc-500" />
              <span>View Penalty History</span>
            </button>
          </div>
        </div>

        {/* Two Independent System Panels: Personal vs Team */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4 pt-4 border-t border-zinc-100 dark:border-zinc-800">
          {/* 1. Personal Task Penalty Box */}
          <div
            className={`p-3.5 rounded-lg border transition ${
              personalEnabled
                ? "border-blue-200 dark:border-blue-900/60 bg-blue-50/40 dark:bg-blue-950/20"
                : "border-zinc-200 dark:border-zinc-800 bg-zinc-50/40 dark:bg-zinc-850/20 opacity-75"
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200">
                  Personal Task Penalties
                </span>
              </div>

              {/* Independent Toggle Switch */}
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={personalEnabled}
                  onChange={handleTogglePersonal}
                  disabled={togglingPersonal}
                  className="sr-only peer"
                />
                <div className="w-8 h-4 bg-zinc-300 peer-focus:outline-none rounded-full peer dark:bg-zinc-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-blue-600"></div>
                <span className="ml-2 text-[11px] font-semibold text-zinc-600 dark:text-zinc-400">
                  {personalEnabled ? "ON" : "OFF"}
                </span>
              </label>
            </div>

            <div className="flex items-baseline justify-between mt-2.5">
              <span className="text-xs text-zinc-500">Current Month Count:</span>
              <span className="text-lg font-black text-blue-600 dark:text-blue-400 font-mono">
                {loadingSummary ? "—" : summary?.currentCounts?.personal ?? 0}
              </span>
            </div>
            <p className="text-[10px] text-zinc-400 mt-1">
              {personalEnabled
                ? "Active: Overdue personal tasks generate 1 penalty each."
                : "Disabled: Personal tasks will not incur penalties."}
            </p>
          </div>

          {/* 2. Team Task Penalty Box */}
          <div
            className={`p-3.5 rounded-lg border transition ${
              teamEnabled
                ? "border-purple-200 dark:border-purple-900/60 bg-purple-50/40 dark:bg-purple-950/20"
                : "border-zinc-200 dark:border-zinc-800 bg-zinc-50/40 dark:bg-zinc-850/20 opacity-75"
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200">
                  Team Task Penalties
                </span>
              </div>

              {/* Independent Toggle Switch */}
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={teamEnabled}
                  onChange={handleToggleTeam}
                  disabled={togglingTeam}
                  className="sr-only peer"
                />
                <div className="w-8 h-4 bg-zinc-300 peer-focus:outline-none rounded-full peer dark:bg-zinc-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-purple-600"></div>
                <span className="ml-2 text-[11px] font-semibold text-zinc-600 dark:text-zinc-400">
                  {teamEnabled ? "ON" : "OFF"}
                </span>
              </label>
            </div>

            <div className="flex items-baseline justify-between mt-2.5">
              <span className="text-xs text-zinc-500">Current Month Count:</span>
              <span className="text-lg font-black text-purple-600 dark:text-purple-400 font-mono">
                {loadingSummary ? "—" : summary?.currentCounts?.team ?? 0}
              </span>
            </div>
            <p className="text-[10px] text-zinc-400 mt-1">
              {teamEnabled
                ? "Active: Associated with the responsible member assigned."
                : "Disabled: Team tasks will not incur penalties."}
            </p>
          </div>
        </div>
      </div>

      {/* History & Inspection Modal */}
      {historyOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/50 backdrop-blur-xs animate-in fade-in">
          <div className="relative w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 dark:border-zinc-800 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400">
                  <History className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                    Penalty Records & History
                  </h2>
                  <p className="text-xs text-zinc-500">
                    Permanent audit history with monthly reset tracking
                  </p>
                </div>
              </div>

              <button
                onClick={() => setHistoryOpen(false)}
                className="rounded-lg p-1.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Month Selector Bar & Scope Filter */}
            <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-3 bg-zinc-50 dark:bg-zinc-850/50 border-b border-zinc-100 dark:border-zinc-800 shrink-0">
              {/* Month Selector */}
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-zinc-400" />
                <span className="text-xs font-semibold text-zinc-600 dark:text-zinc-400">
                  Month:
                </span>
                <select
                  value={selectedMonth}
                  onChange={(e) => handleMonthChange(e.target.value)}
                  className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-2.5 py-1 text-xs font-semibold text-zinc-800 dark:text-zinc-200 focus:outline-none"
                >
                  {(summary?.availableMonths || [summary?.currentMonthYear]).map(
                    (mStr: string) => (
                      <option key={mStr} value={mStr}>
                        {formatMonthTitle(mStr)}
                        {mStr === summary?.currentMonthYear ? " (Current)" : ""}
                      </option>
                    )
                  )}
                </select>
              </div>

              {/* Task Type Filter */}
              <div className="flex items-center rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 p-0.5 text-xs font-medium">
                {(["ALL", "PERSONAL", "TEAM"] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setHistoryTypeFilter(mode)}
                    className={`rounded-md px-2.5 py-1 capitalize transition ${
                      historyTypeFilter === mode
                        ? "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-semibold shadow-xs"
                        : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
                    }`}
                  >
                    {mode === "ALL" ? "All" : mode === "PERSONAL" ? "Personal" : "Team"}
                  </button>
                ))}
              </div>
            </div>

            {/* Month Summary Counters */}
            <div className="px-6 py-3 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/40 dark:bg-zinc-900 shrink-0">
              <div className="flex items-center justify-between text-xs text-zinc-600 dark:text-zinc-400">
                <span>
                  Showing penalties for <strong>{selectedMonthTitle}</strong>:
                </span>
                <div className="flex items-center gap-3 font-mono text-xs">
                  <span className="text-blue-600 dark:text-blue-400 font-semibold">
                    Personal: {summary?.selectedCounts?.personal ?? 0}
                  </span>
                  <span>•</span>
                  <span className="text-purple-600 dark:text-purple-400 font-semibold">
                    Team: {summary?.selectedCounts?.team ?? 0}
                  </span>
                  <span>•</span>
                  <span className="font-bold text-zinc-900 dark:text-zinc-100">
                    Total: {summary?.selectedCounts?.total ?? 0}
                  </span>
                </div>
              </div>
            </div>

            {/* List of Penalties */}
            <div className="flex-1 overflow-y-auto p-6 divide-y divide-zinc-100 dark:divide-zinc-800">
              {loadingHistory ? (
                <div className="flex flex-col items-center justify-center py-12 text-zinc-400 space-y-2">
                  <Loader2 className="h-6 w-6 animate-spin text-zinc-500" />
                  <p className="text-xs">Loading penalty records...</p>
                </div>
              ) : penaltiesToDisplay.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center text-zinc-500 space-y-2">
                  <CheckCircle2 className="h-8 w-8 text-emerald-500" />
                  <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                    No Penalties Recorded
                  </p>
                  <p className="text-xs text-zinc-400 max-w-sm">
                    No overdue task penalties were recorded for {selectedMonthTitle} under the selected filter.
                  </p>
                </div>
              ) : (
                penaltiesToDisplay.map((p: any) => {
                  const isPersonal = p.taskType === "PERSONAL";
                  return (
                    <div
                      key={p.id}
                      className="py-3.5 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              isPersonal
                                ? "bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300"
                                : "bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300"
                            }`}
                          >
                            {isPersonal ? "PERSONAL" : "TEAM"}
                          </span>

                          <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                            {p.taskTitle}
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-500">
                          {p.team && (
                            <span className="flex items-center gap-1 font-medium text-purple-600 dark:text-purple-400">
                              <Users className="h-3 w-3" />
                              <span>{p.team.name}</span>
                            </span>
                          )}

                          {p.responsibleUser && (
                            <span className="flex items-center gap-1">
                              <User className="h-3 w-3 text-zinc-400" />
                              <span>Responsible: {p.responsibleUser.name || p.responsibleUser.email}</span>
                            </span>
                          )}

                          <span className="flex items-center gap-1 font-mono text-[11px]">
                            <Clock className="h-3 w-3 text-red-500" />
                            <span>
                              Deadline: {format(parseISO(p.deadline), "MMM d, yyyy HH:mm")}
                            </span>
                          </span>
                        </div>
                      </div>

                      <div className="shrink-0 flex items-center gap-2 self-start sm:self-center">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300">
                          +1 Penalty
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-850/50 flex items-center justify-between text-[11px] text-zinc-500 shrink-0">
              <span className="flex items-center gap-1">
                <Info className="h-3.5 w-3.5 text-zinc-400" />
                <span>Counts reset to 0 on the 1st of each month without losing history.</span>
              </span>
              <button
                onClick={() => setHistoryOpen(false)}
                className="px-3 py-1 rounded-lg bg-zinc-200 dark:bg-zinc-700 text-xs font-semibold text-zinc-800 dark:text-zinc-200 hover:bg-zinc-300 dark:hover:bg-zinc-600 transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
