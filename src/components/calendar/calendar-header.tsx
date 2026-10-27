"use client";

import Link from "next/link";
import { CalendarViewMode } from "./calendar-root";
import { format } from "date-fns";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Filter,
  Calendar as CalendarIcon,
  Send,
  Inbox,
  Star,
} from "lucide-react";

interface TeamOption {
  id: string;
  name: string;
  role: string;
}

interface CalendarHeaderProps {
  currentDate: Date;
  viewMode: CalendarViewMode;
  onViewModeChange: (mode: CalendarViewMode) => void;
  defaultView?: CalendarViewMode;
  onSetDefaultView?: (mode: CalendarViewMode) => void;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  filter: string;
  onFilterChange: (filter: string) => void;
  teams: TeamOption[];
  onOpenNewTaskModal: () => void;
  onOpenProposeTaskModal?: () => void;
}

export function CalendarHeader({
  currentDate,
  viewMode,
  onViewModeChange,
  defaultView,
  onSetDefaultView,
  onPrev,
  onNext,
  onToday,
  filter,
  onFilterChange,
  teams,
  onOpenNewTaskModal,
  onOpenProposeTaskModal,
}: CalendarHeaderProps) {
  // Format header title based on view mode
  const getHeaderTitle = () => {
    switch (viewMode) {
      case "month":
        return format(currentDate, "MMMM yyyy");
      case "week":
        return `Week of ${format(currentDate, "MMM d, yyyy")}`;
      case "day":
        return format(currentDate, "EEEE, MMMM d, yyyy");
      case "agenda":
        return `Agenda — ${format(currentDate, "MMMM yyyy")}`;
    }
  };

  return (
    <div className="flex flex-col gap-3 sm:gap-4 pb-4 border-b border-zinc-200 dark:border-zinc-800">
      {/* Top Row: Date navigation & Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-0.5 shadow-sm shrink-0">
            <button
              onClick={onPrev}
              className="rounded-md p-1.5 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
              title="Previous"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={onToday}
              className="px-2.5 py-1 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
            >
              Today
            </button>
            <button
              onClick={onNext}
              className="rounded-md p-1.5 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
              title="Next"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <h1 className="text-lg sm:text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 truncate">
            {getHeaderTitle()}
          </h1>
        </div>

        {/* Action Buttons (New Task & Propose Task) on desktop / tablet */}
        <div className="hidden sm:flex items-center gap-2">
          {onOpenProposeTaskModal && (
            <button
              onClick={onOpenProposeTaskModal}
              className="flex items-center gap-1.5 rounded-lg border border-purple-200 dark:border-purple-800 bg-purple-50/70 dark:bg-purple-950/30 px-3 py-1.5 text-xs font-semibold text-purple-700 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-900/50 transition shadow-xs"
              title="Propose a task to a team member"
            >
              <Send className="h-3.5 w-3.5" />
              <span>Propose Task</span>
            </button>
          )}

          <button
            onClick={onOpenNewTaskModal}
            className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-blue-700 transition"
          >
            <Plus className="h-4 w-4" />
            <span>New Task</span>
          </button>

          <Link
            href="/inbox"
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
            title="View Task Proposals & Inbox"
          >
            <Inbox className="h-4 w-4" />
          </Link>
        </div>
      </div>

      {/* Second Row: View switchers & Filter dropdown */}
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex flex-wrap items-center gap-2">
          {/* View Mode buttons (Month, Week, Day, Agenda) */}
          <div className="flex items-center rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-800 p-0.5 text-xs font-medium">
            {(["month", "week", "day", "agenda"] as CalendarViewMode[]).map((mode) => (
              <button
                key={mode}
                onClick={() => onViewModeChange(mode)}
                className={`rounded-md px-2.5 py-1 capitalize transition ${
                  viewMode === mode
                    ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-xs font-semibold"
                    : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
                }`}
              >
                {mode}
              </button>
            ))}
          </div>

          {/* Default view indicator / set default button */}
          {onSetDefaultView && (
            viewMode === defaultView ? (
              <span
                className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-800/80 shadow-xs"
                title={`"${viewMode}" is currently your default calendar view`}
              >
                <Star className="h-3 w-3 fill-amber-500 text-amber-500" />
                <span className="hidden sm:inline">Default</span>
              </span>
            ) : (
              <button
                type="button"
                onClick={() => onSetDefaultView(viewMode)}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium text-zinc-600 dark:text-zinc-400 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/30 border border-zinc-200 dark:border-zinc-800 hover:border-amber-300 dark:hover:border-amber-800 transition shadow-xs"
                title={`Set "${viewMode}" as your default view whenever you open the calendar`}
              >
                <Star className="h-3 w-3 text-zinc-400 group-hover:text-amber-500" />
                <span className="hidden sm:inline">Set default</span>
                <span className="sm:hidden">Default</span>
              </button>
            )
          )}

          {/* Team filter dropdown */}
          <div className="flex items-center gap-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-2.5 py-1.5 shadow-sm text-xs font-medium text-zinc-700 dark:text-zinc-300">
            <Filter className="h-3.5 w-3.5 text-zinc-500" />
            <select
              value={filter}
              onChange={(e) => onFilterChange(e.target.value)}
              className="bg-transparent text-xs font-medium focus:outline-none cursor-pointer max-w-[140px] sm:max-w-none truncate"
            >
              <option value="all">🌐 Everything</option>
              <option value="all-assigned-to-me">🎯 All Mine</option>
              <option value="personal">🔒 Personal Only</option>
              <option value="team">👥 The Whole Crew</option>
              <option value="team-assigned-to-me">👤 Team → Me</option>
              <option value="team-assigned-to-others">👥 Team → Others</option>
              {teams.length > 0 && (
                <optgroup label="Teams">
                  {teams.map((t) => (
                    <option key={t.id} value={t.id}>
                      Team: {t.name}
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
          </div>
        </div>

        {/* Mobile Action Buttons (Visible only on small screens) */}
        <div className="flex sm:hidden items-center gap-2 w-full mt-1">
          <button
            onClick={onOpenNewTaskModal}
            className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-blue-700 transition"
          >
            <Plus className="h-4 w-4" />
            <span>New Task</span>
          </button>

          {onOpenProposeTaskModal && (
            <button
              onClick={onOpenProposeTaskModal}
              className="flex items-center gap-1.5 rounded-lg border border-purple-200 dark:border-purple-800 bg-purple-50/70 dark:bg-purple-950/30 px-3 py-1.5 text-xs font-semibold text-purple-700 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-900/50 transition shadow-xs"
              title="Propose a task to a team member"
            >
              <Send className="h-3.5 w-3.5" />
              <span>Propose</span>
            </button>
          )}

          <Link
            href="/inbox"
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition border border-zinc-200 dark:border-zinc-800"
            title="View Task Proposals & Inbox"
          >
            <Inbox className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
