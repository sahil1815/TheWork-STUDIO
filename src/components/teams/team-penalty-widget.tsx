"use client";

import { useState, useEffect } from "react";
import { Role } from "@prisma/client";
import { format, parseISO } from "date-fns";
import {
  getTeamPenaltySummaryAction,
  toggleTeamPenaltiesAction,
  waiveTeamTaskPenaltyAction,
} from "@/actions/task-actions";
import {
  AlertTriangle,
  Calendar,
  Users,
  Shield,
  ShieldCheck,
  CheckCircle2,
  Trash2,
  RefreshCw,
  Info,
  Clock,
  User,
  ArrowRight,
  Trophy,
  Target,
  Check,
} from "lucide-react";

interface TeamPenaltyWidgetProps {
  teamId: string;
  teamName: string;
  currentUserRole: Role;
  currentUserId: string;
}

export function TeamPenaltyWidget({
  teamId,
  teamName,
  currentUserRole,
  currentUserId,
}: TeamPenaltyWidgetProps) {
  const isMasterAdmin = currentUserRole === Role.OWNER;
  const isAdmin = currentUserRole === Role.ADMIN || isMasterAdmin;

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<string>("");
  const [toggling, setToggling] = useState(false);
  const [waivingId, setWaivingId] = useState<string | null>(null);
  const [viewTab, setViewTab] = useState<"PENALTIES" | "COMPLETED">("PENALTIES");

  const loadTeamPenalties = async (month?: string) => {
    try {
      setLoading(true);
      const res = await getTeamPenaltySummaryAction(teamId, month);
      if (res.success && res.data) {
        setData(res.data);
        if (!selectedMonth) {
          setSelectedMonth(res.data.selectedMonthYear);
        }
      }
    } catch (err) {
      console.error("Failed to load team penalties:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTeamPenalties();
  }, [teamId]);

  const handleMonthChange = async (monthStr: string) => {
    setSelectedMonth(monthStr);
    await loadTeamPenalties(monthStr);
  };

  const handleToggle = async () => {
    if (!isAdmin) {
      alert("A team task penalty should only be editable by the master admin and the admin.");
      return;
    }
    const currentEnabled = data?.penaltiesEnabled ?? true;
    const nextVal = !currentEnabled;
    setToggling(true);
    const res = await toggleTeamPenaltiesAction(teamId, nextVal);
    if (res.success) {
      await loadTeamPenalties(selectedMonth);
    } else {
      alert(res.error || "Failed to update team penalty settings");
    }
    setToggling(false);
  };

  const handleWaivePenalty = async (penaltyId: string, taskTitle: string) => {
    if (!isAdmin) {
      alert("A team task penalty should only be editable by the master admin and the admin.");
      return;
    }
    if (!window.confirm(`Are you sure you want to waive the penalty for "${taskTitle}"?`)) {
      return;
    }
    setWaivingId(penaltyId);
    const res = await waiveTeamTaskPenaltyAction(teamId, penaltyId);
    if (res.success) {
      await loadTeamPenalties(selectedMonth);
    } else {
      alert(res.error || "Failed to waive penalty");
    }
    setWaivingId(null);
  };

  const formatMonthTitle = (monthYearStr?: string) => {
    if (!monthYearStr) return "";
    try {
      return format(parseISO(`${monthYearStr}-01`), "MMMM yyyy");
    } catch {
      return monthYearStr;
    }
  };

  const currentMonthTitle = formatMonthTitle(data?.currentMonthYear);
  const selectedMonthTitle = formatMonthTitle(data?.selectedMonthYear || selectedMonth);
  const penaltiesEnabled = data?.penaltiesEnabled ?? true;

  return (
    <div className="space-y-6">
      {/* 1. Header Card with Controls */}
      <div className="p-5 sm:p-6 rounded-2xl border border-purple-200 dark:border-purple-900/60 bg-gradient-to-br from-purple-50/70 via-white to-purple-50/40 dark:from-purple-950/20 dark:via-zinc-900 dark:to-zinc-900 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-purple-600 text-white shadow-md">
              <Trophy className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">
                  Team Performance & Accountability
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-purple-100 dark:bg-purple-900/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                  {penaltiesEnabled ? "Penalties Active" : "Penalties Disabled"}
                </span>
              </div>
              <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-1">
                Track finished tasks, overdue task penalties, and member accountability across the month and lifetime.
              </p>

              {/* Quick High-Level Metrics Pill Row */}
              <div className="flex items-center gap-2 mt-2.5 flex-wrap text-xs">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-bold bg-emerald-100/80 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>{data?.completedCounts?.selectedMonth ?? 0} Done this month</span>
                </span>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-bold bg-blue-100/80 dark:bg-blue-950/70 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                  <Trophy className="h-3.5 w-3.5" />
                  <span>{data?.completedCounts?.lifetime ?? 0} Lifetime finished</span>
                </span>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-bold bg-purple-100/80 dark:bg-purple-950/70 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                  <Target className="h-3.5 w-3.5" />
                  <span>{data?.completedCounts?.completionRate ?? 100}% Success rate</span>
                </span>
              </div>
            </div>
          </div>

          {/* Month Selector & Controls */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Month Dropdown */}
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs">
              <Calendar className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
              <span className="font-semibold text-zinc-500 dark:text-zinc-400">Month:</span>
              <select
                value={selectedMonth}
                onChange={(e) => handleMonthChange(e.target.value)}
                className="bg-transparent font-bold text-zinc-800 dark:text-zinc-200 focus:outline-none cursor-pointer"
              >
                {(data?.availableMonths || [data?.currentMonthYear]).map((mStr: string) => (
                  <option
                    key={mStr}
                    value={mStr}
                    className="bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                  >
                    {formatMonthTitle(mStr)}
                    {mStr === data?.currentMonthYear ? " (Current)" : ""}
                  </option>
                ))}
              </select>
            </div>

            {/* Refresh Button */}
            <button
              onClick={() => loadTeamPenalties(selectedMonth)}
              disabled={loading}
              className="p-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition"
              title="Refresh penalties"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        {/* System Setting Toggle Bar */}
        <div className="mt-5 pt-4 border-t border-purple-100 dark:border-purple-900/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-purple-600 dark:text-purple-400" />
            <span className="font-semibold text-zinc-800 dark:text-zinc-200">
              Team Penalty Enforcement:
            </span>
            <span
              className={`font-bold ${
                penaltiesEnabled
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-zinc-500 dark:text-zinc-400"
              }`}
            >
              {penaltiesEnabled ? "ENABLED" : "DISABLED"}
            </span>
            <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
              (Managed strictly by Master Admin and Admins)
            </span>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            {isAdmin ? (
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={penaltiesEnabled}
                  onChange={handleToggle}
                  disabled={toggling}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-zinc-300 peer-focus:outline-none rounded-full peer dark:bg-zinc-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-purple-600"></div>
                <span className="ml-2 text-xs font-bold text-purple-700 dark:text-purple-300">
                  {penaltiesEnabled ? "ON" : "OFF"}
                </span>
              </label>
            ) : (
              <span className="px-2.5 py-1 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-[11px] font-semibold text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700">
                View Only (Admin setting)
              </span>
            )}
          </div>
        </div>
      </div>

      {/* 2. Key Performance Summary Cards (4-Card Grid) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Finished This Month */}
        <div className="p-4 rounded-xl border border-emerald-200 dark:border-emerald-900/60 bg-white dark:bg-zinc-900 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
              Finished This Month
            </span>
            <span className="p-1.5 rounded-lg bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300">
              <CheckCircle2 className="h-4 w-4" />
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400 font-mono">
              {loading ? "—" : data?.completedCounts?.selectedMonth ?? 0}
            </span>
            <span className="text-xs font-medium text-zinc-500">
              in {selectedMonthTitle}
            </span>
          </div>
          <p className="text-[11px] text-zinc-400 mt-1">
            Completed tasks delivered for this month.
          </p>
        </div>

        {/* Card 2: Lifetime Finished */}
        <div className="p-4 rounded-xl border border-blue-200 dark:border-blue-900/60 bg-white dark:bg-zinc-900 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
              Lifetime Finished
            </span>
            <span className="p-1.5 rounded-lg bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300">
              <Trophy className="h-4 w-4" />
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-blue-600 dark:text-blue-400 font-mono">
              {loading ? "—" : data?.completedCounts?.lifetime ?? 0}
            </span>
            <span className="text-xs font-medium text-zinc-500">
              all-time completed
            </span>
          </div>
          <p className="text-[11px] text-zinc-400 mt-1">
            Total tasks delivered across team lifetime.
          </p>
        </div>

        {/* Card 3: Team Overdue Penalties */}
        <div className="p-4 rounded-xl border border-purple-200 dark:border-purple-900/60 bg-white dark:bg-zinc-900 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
              Team Penalties
            </span>
            <span className="p-1.5 rounded-lg bg-purple-100 dark:bg-purple-900/60 text-purple-700 dark:text-purple-300">
              <AlertTriangle className="h-4 w-4" />
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-purple-600 dark:text-purple-400 font-mono">
              {loading ? "—" : data?.totalPenalties ?? 0}
            </span>
            <span className="text-xs font-medium text-zinc-500">
              in {selectedMonthTitle}
            </span>
          </div>
          <p className="text-[11px] text-zinc-400 mt-1">
            Overdue tasks across all team members.
          </p>
        </div>

        {/* Card 4: Success Rate */}
        <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
              Completion Rate
            </span>
            <span className="p-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-purple-600 dark:text-purple-400">
              <Target className="h-4 w-4" />
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-zinc-900 dark:text-zinc-100 font-mono">
              {loading ? "—" : `${data?.completedCounts?.completionRate ?? 100}%`}
            </span>
            <span className="text-xs font-medium text-zinc-500">
              monthly success score
            </span>
          </div>
          <p className="text-[11px] text-zinc-400 mt-1">
            {data?.members?.length ?? 0} active members on roster.
          </p>
        </div>
      </div>

      {/* 3. Individual Team Members Breakdown Table */}
      <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden shadow-sm">
        <div className="px-5 py-4 border-b border-zinc-100 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-3 bg-zinc-50/60 dark:bg-zinc-800/30">
          <div>
            <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
              <Users className="h-4 w-4 text-purple-600 dark:text-purple-400" />
              <span>Individual Member Performance & Accountability</span>
            </h3>
            <p className="text-xs text-zinc-500">
              Finished tasks (month & lifetime), overdue penalties, and completion rates for {selectedMonthTitle}.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap text-xs">
            <span className="font-bold px-2.5 py-1 rounded-lg bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900/60">
              Month Done: {data?.completedCounts?.selectedMonth ?? 0}
            </span>
            <span className="font-bold px-2.5 py-1 rounded-lg bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-900/60">
              Lifetime: {data?.completedCounts?.lifetime ?? 0}
            </span>
            <span className="font-bold px-2.5 py-1 rounded-lg bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-900/60">
              Penalties: {data?.totalPenalties ?? 0}
            </span>
          </div>
        </div>

        <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {(data?.members || []).map((member: any) => {
            const isSelf = member.userId === currentUserId;
            const hasPenalties = member.penaltyCount > 0;

            return (
              <div
                key={member.userId}
                className="flex flex-col sm:flex-row sm:items-center justify-between p-4 gap-4 hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30 transition"
              >
                {/* Member Info */}
                <div className="flex items-center gap-3 min-w-0">
                  {member.image ? (
                    <img
                      src={member.image}
                      alt={member.name}
                      className="h-10 w-10 shrink-0 rounded-full object-cover border border-purple-200 dark:border-purple-800"
                    />
                  ) : (
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-purple-100 dark:bg-purple-900/60 text-purple-700 dark:text-purple-300 font-bold text-sm">
                      {member.name?.[0]?.toUpperCase() || member.email?.[0]?.toUpperCase() || "U"}
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm text-zinc-900 dark:text-zinc-100 truncate">
                        {member.name}
                      </span>
                      {isSelf && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300">
                          You
                        </span>
                      )}
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                        {member.role === Role.OWNER ? "Master Admin" : member.role}
                      </span>
                    </div>
                    <span className="text-xs text-zinc-500 block truncate">{member.email}</span>
                  </div>
                </div>

                {/* Individual Person Performance Badges */}
                <div className="flex items-center gap-2 sm:gap-3 flex-wrap self-start sm:self-center">
                  {/* Month Done */}
                  <div className="flex flex-col items-center px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/60 dark:border-emerald-900/40 min-w-[70px]">
                    <span className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                      Month Done
                    </span>
                    <span className="text-xs font-black text-emerald-700 dark:text-emerald-300 font-mono">
                      {member.completedMonth ?? 0}
                    </span>
                  </div>

                  {/* Lifetime Finished */}
                  <div className="flex flex-col items-center px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/40 border border-blue-200/60 dark:border-blue-900/40 min-w-[70px]">
                    <span className="text-[9px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">
                      Lifetime
                    </span>
                    <span className="text-xs font-black text-blue-700 dark:text-blue-300 font-mono">
                      {member.completedLifetime ?? 0}
                    </span>
                  </div>

                  {/* Penalties */}
                  <div
                    className={`flex flex-col items-center px-2.5 py-1 rounded-lg border min-w-[70px] ${
                      hasPenalties
                        ? "bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-900/40 text-red-700 dark:text-red-300"
                        : "bg-zinc-50 dark:bg-zinc-800/40 border-zinc-200 dark:border-zinc-700/60 text-zinc-600 dark:text-zinc-400"
                    }`}
                  >
                    <span className="text-[9px] font-bold uppercase tracking-wider">
                      Penalties
                    </span>
                    <span className="text-xs font-black font-mono">
                      {member.penaltyCount ?? 0}
                    </span>
                  </div>

                  {/* Success Rate */}
                  <div className="flex flex-col items-center px-2.5 py-1 rounded-lg bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-900/40 min-w-[65px]">
                    <span className="text-[9px] font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wider">
                      Rate
                    </span>
                    <span className="text-xs font-black text-purple-700 dark:text-purple-300 font-mono">
                      {member.completionRate ?? 100}%
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Table Summary Footer */}
        <div className="px-5 py-3 bg-zinc-50 dark:bg-zinc-800/50 border-t border-zinc-100 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-3 text-xs font-bold text-zinc-800 dark:text-zinc-200">
          <div className="flex items-center gap-4 flex-wrap">
            <span>
              Month Finished:{" "}
              <strong className="text-emerald-600 dark:text-emerald-400 font-mono">
                {data?.completedCounts?.selectedMonth ?? 0}
              </strong>
            </span>
            <span>
              Lifetime Finished:{" "}
              <strong className="text-blue-600 dark:text-blue-400 font-mono">
                {data?.completedCounts?.lifetime ?? 0}
              </strong>
            </span>
            <span>
              Total Overdue:{" "}
              <strong className="text-purple-600 dark:text-purple-400 font-mono">
                {data?.totalPenalties ?? 0}
              </strong>
            </span>
          </div>
          <div>
            Team Completion Rate:{" "}
            <span className="text-sm font-black text-purple-600 dark:text-purple-400 font-mono">
              {data?.completedCounts?.completionRate ?? 100}%
            </span>
          </div>
        </div>
      </div>

      {/* 4. Detailed Records Section (Penalties vs Completed Tasks Tabs) */}
      <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden shadow-sm">
        <div className="px-5 py-4 border-b border-zinc-100 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-zinc-50/60 dark:bg-zinc-800/30">
          <div>
            <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
              Monthly Task Records ({selectedMonthTitle})
            </h3>
            <p className="text-xs text-zinc-500">
              Inspect overdue penalties or completed tasks logged for this team.
            </p>
          </div>

          {/* Tab Selector */}
          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-xs">
            <button
              onClick={() => setViewTab("PENALTIES")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition ${
                viewTab === "PENALTIES"
                  ? "bg-white dark:bg-zinc-900 text-purple-600 dark:text-purple-400 shadow-2xs"
                  : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200"
              }`}
            >
              <AlertTriangle className="h-3.5 w-3.5" />
              <span>Overdue Penalties ({data?.penalties?.length ?? 0})</span>
            </button>
            <button
              onClick={() => setViewTab("COMPLETED")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition ${
                viewTab === "COMPLETED"
                  ? "bg-white dark:bg-zinc-900 text-emerald-600 dark:text-emerald-400 shadow-2xs"
                  : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200"
              }`}
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>Completed Tasks ({data?.completedTasks?.length ?? 0})</span>
            </button>
          </div>
        </div>

        {/* Tab 1: Overdue Penalties */}
        {viewTab === "PENALTIES" && (
          <div>
            {(!data?.penalties || data.penalties.length === 0) ? (
              <div className="p-8 text-center text-zinc-500 space-y-2">
                <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto opacity-80" />
                <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                  No Penalties for {selectedMonthTitle}
                </p>
                <p className="text-xs text-zinc-400 max-w-sm mx-auto">
                  All team tasks for this month were either completed on time or are not overdue. Keep up the great work!
                </p>
              </div>
            ) : (
              <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {data.penalties.map((p: any) => (
                  <div
                    key={p.id}
                    className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-zinc-50/60 dark:hover:bg-zinc-800/30 transition"
                  >
                    <div className="space-y-1 flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm text-zinc-900 dark:text-zinc-100 truncate">
                          {p.taskTitle}
                        </span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300">
                          +1 Penalty
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-500">
                        <span className="flex items-center gap-1">
                          <User className="h-3 w-3 text-purple-500" />
                          <span>
                            Responsible:{" "}
                            <strong className="text-zinc-700 dark:text-zinc-300">
                              {p.responsibleUser?.name || p.responsibleUser?.email || "Assignee"}
                            </strong>
                          </span>
                        </span>

                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3 text-zinc-400" />
                          <span>Deadline: {p.taskDate} {p.taskTiming}</span>
                        </span>

                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3 text-zinc-400" />
                          <span>Recorded: {format(parseISO(p.penaltyDate), "MMM d, yyyy")}</span>
                        </span>
                      </div>
                    </div>

                    {/* Waive / Remove action for Master Admin & Admin */}
                    {isAdmin && (
                      <div className="self-end sm:self-center">
                        <button
                          onClick={() => handleWaivePenalty(p.id, p.taskTitle)}
                          disabled={waivingId === p.id}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-200 dark:border-red-900/60 text-xs font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition"
                          title="Waive this penalty as Master Admin / Admin"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          <span>{waivingId === p.id ? "Waiving..." : "Waive"}</span>
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Completed Tasks */}
        {viewTab === "COMPLETED" && (
          <div>
            {(!data?.completedTasks || data.completedTasks.length === 0) ? (
              <div className="p-8 text-center text-zinc-500 space-y-2">
                <Info className="h-8 w-8 text-zinc-400 mx-auto opacity-80" />
                <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                  No Completed Tasks for {selectedMonthTitle}
                </p>
                <p className="text-xs text-zinc-400 max-w-sm mx-auto">
                  Team tasks marked as DONE in {selectedMonthTitle} will be listed here.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {data.completedTasks.map((t: any) => (
                  <div
                    key={t.id}
                    className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-zinc-50/60 dark:hover:bg-zinc-800/30 transition"
                  >
                    <div className="space-y-1 flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm text-zinc-900 dark:text-zinc-100 truncate">
                          {t.title}
                        </span>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                          <CheckCircle2 className="h-3 w-3" />
                          <span>Done</span>
                        </span>
                        {t.priority && (
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              t.priority === "HIGH"
                                ? "bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300"
                                : t.priority === "MEDIUM"
                                ? "bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300"
                                : "bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300"
                            }`}
                          >
                            {t.priority}
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-500">
                        {/* Assignee / Assignees list */}
                        {t.assignees && t.assignees.length > 0 ? (
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-zinc-400">Assignees:</span>
                            {t.assignees.map((assignee: any) => (
                              <span
                                key={assignee.id}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-[11px] font-medium"
                              >
                                <User className="h-3 w-3 text-purple-500" />
                                <span>{assignee.name || assignee.email}</span>
                              </span>
                            ))}
                          </div>
                        ) : t.assignee ? (
                          <span className="flex items-center gap-1">
                            <User className="h-3 w-3 text-purple-500" />
                            <span>
                              Assignee:{" "}
                              <strong className="text-zinc-700 dark:text-zinc-300">
                                {t.assignee.name || t.assignee.email}
                              </strong>
                            </span>
                          </span>
                        ) : null}

                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3 text-zinc-400" />
                          <span>Date: {t.date}</span>
                        </span>

                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3 text-zinc-400" />
                          <span>Time: {t.timing}</span>
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="px-5 py-3 bg-zinc-50/70 dark:bg-zinc-800/40 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between text-[11px] text-zinc-500">
          <span className="flex items-center gap-1">
            <Info className="h-3.5 w-3.5 text-zinc-400" />
            <span>Monthly records are permanently archived in the database.</span>
          </span>
          <span className="font-semibold text-zinc-600 dark:text-zinc-400">
            {teamName}
          </span>
        </div>
      </div>
    </div>
  );
}
