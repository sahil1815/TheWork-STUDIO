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
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">
                  Team Penalty Management
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-purple-100 dark:bg-purple-900/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                  {penaltiesEnabled ? "Penalties Active" : "Penalties Disabled"}
                </span>
              </div>
              <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-1">
                Overdue team tasks incur 1 penalty for the responsible member. Resets on the 1st of each month with permanent history.
              </p>
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

      {/* 2. Key Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Total Included Team Penalties */}
        <div className="p-4 rounded-xl border border-purple-200 dark:border-purple-900/60 bg-white dark:bg-zinc-900 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
              Total Team Penalties
            </span>
            <span className="p-1.5 rounded-lg bg-purple-100 dark:bg-purple-900/60 text-purple-700 dark:text-purple-300">
              <Users className="h-4 w-4" />
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-purple-600 dark:text-purple-400 font-mono">
              {loading ? "—" : data?.totalPenalties ?? 0}
            </span>
            <span className="text-xs font-medium text-zinc-500">
              penalties in {selectedMonthTitle}
            </span>
          </div>
          <p className="text-[11px] text-zinc-400 mt-1">
            Included sum of all individual team members' penalties.
          </p>
        </div>

        {/* Current Month Live Total */}
        <div className="p-4 rounded-xl border border-blue-200 dark:border-blue-900/60 bg-white dark:bg-zinc-900 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
              Current Month Total
            </span>
            <span className="p-1.5 rounded-lg bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300">
              <Calendar className="h-4 w-4" />
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-blue-600 dark:text-blue-400 font-mono">
              {loading ? "—" : data?.currentMonthTotal ?? 0}
            </span>
            <span className="text-xs font-medium text-zinc-500">
              in {currentMonthTitle}
            </span>
          </div>
          <p className="text-[11px] text-zinc-400 mt-1">
            Live count for active calendar month. Resets automatically on 1st.
          </p>
        </div>

        {/* Member Accountability */}
        <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
              Team Roster
            </span>
            <span className="p-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
              <User className="h-4 w-4" />
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-zinc-900 dark:text-zinc-100 font-mono">
              {data?.members?.length ?? 0}
            </span>
            <span className="text-xs font-medium text-zinc-500">
              active members
            </span>
          </div>
          <p className="text-[11px] text-zinc-400 mt-1">
            {data?.members?.filter((m: any) => m.penaltyCount > 0).length ?? 0} member(s) with penalties in {selectedMonthTitle}.
          </p>
        </div>
      </div>

      {/* 3. Individual Team Members Breakdown Table */}
      <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden shadow-sm">
        <div className="px-5 py-4 border-b border-zinc-100 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-3 bg-zinc-50/60 dark:bg-zinc-800/30">
          <div>
            <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
              <Users className="h-4 w-4 text-purple-600 dark:text-purple-400" />
              <span>Individual Team Member Penalties</span>
            </h3>
            <p className="text-xs text-zinc-500">
              Individual penalty counts for {selectedMonthTitle} alongside the total team count.
            </p>
          </div>

          <div className="text-xs font-bold px-3 py-1 rounded-lg bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-900/60">
            Total Included Sum: {data?.totalPenalties ?? 0}
          </div>
        </div>

        <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {(data?.members || []).map((member: any) => {
            const isSelf = member.userId === currentUserId;
            const hasPenalties = member.penaltyCount > 0;

            return (
              <div
                key={member.userId}
                className="flex flex-col sm:flex-row sm:items-center justify-between p-4 gap-3 hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30 transition"
              >
                {/* Member Info */}
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-purple-100 dark:bg-purple-900/60 text-purple-700 dark:text-purple-300 font-bold text-sm">
                    {member.name?.[0]?.toUpperCase() || member.email?.[0]?.toUpperCase() || "U"}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm text-zinc-900 dark:text-zinc-100">
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

                {/* Individual Person Penalty Count */}
                <div className="flex items-center gap-3 self-end sm:self-center">
                  <div className="text-right">
                    <span
                      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
                        hasPenalties
                          ? "bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-900/60"
                          : "bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900/60"
                      }`}
                    >
                      {hasPenalties ? (
                        <AlertTriangle className="h-3 w-3" />
                      ) : (
                        <CheckCircle2 className="h-3 w-3" />
                      )}
                      <span>
                        {member.penaltyCount} {member.penaltyCount === 1 ? "penalty" : "penalties"}
                      </span>
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Table Summary Footer */}
        <div className="px-5 py-3 bg-zinc-50 dark:bg-zinc-800/50 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between text-xs font-bold text-zinc-800 dark:text-zinc-200">
          <span>Total Included Penalties ({selectedMonthTitle}):</span>
          <span className="text-sm font-black text-purple-600 dark:text-purple-400 font-mono">
            {data?.totalPenalties ?? 0}
          </span>
        </div>
      </div>

      {/* 4. Detailed Penalty Events Log */}
      <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden shadow-sm">
        <div className="px-5 py-4 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/60 dark:bg-zinc-800/30">
          <div>
            <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
              Penalty Event Records ({selectedMonthTitle})
            </h3>
            <p className="text-xs text-zinc-500">
              All overdue task penalty records logged for this team.
            </p>
          </div>
          {isAdmin && (
            <span className="text-[11px] font-semibold text-purple-600 dark:text-purple-400 flex items-center gap-1">
              <Shield className="h-3.5 w-3.5" />
              <span>Admin waiver actions enabled</span>
            </span>
          )}
        </div>

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
                        Responsible: <strong className="text-zinc-700 dark:text-zinc-300">{p.responsibleUser?.name || p.responsibleUser?.email || "Assignee"}</strong>
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
