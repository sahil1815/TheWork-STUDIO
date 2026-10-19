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
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  filter: string;
  onFilterChange: (filter: string) => void;
  teams: TeamOption[];
  onOpenNewTaskModal: () => void;
}

export function CalendarHeader({
  currentDate,
  viewMode,
  onViewModeChange,
  onPrev,
  onNext,
  onToday,
  filter,
  onFilterChange,
  teams,
  onOpenNewTaskModal,
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
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-zinc-200 dark:border-zinc-800">
      {/* Date navigation */}
      <div className="flex items-center gap-3">
        <div className="flex items-center rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-0.5 shadow-sm">
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

        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
          {getHeaderTitle()}
        </h1>
      </div>

      {/* Controls: View switchers, Team filter, New Task button */}
      <div className="flex flex-wrap items-center gap-2.5">
        {/* Team filter dropdown (FR-07) */}
        <div className="flex items-center gap-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-2.5 py-1.5 shadow-sm text-xs font-medium text-zinc-700 dark:text-zinc-300">
          <Filter className="h-3.5 w-3.5 text-zinc-500" />
          <select
            value={filter}
            onChange={(e) => onFilterChange(e.target.value)}
            className="bg-transparent text-xs font-medium focus:outline-none cursor-pointer"
          >
            <option value="all">All Calendars</option>
            <option value="personal">Personal Tasks Only</option>
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

        {/* View Mode buttons (FR-07: Month, Week, Day, Agenda) */}
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

        {/* Proposals shortcut (FR-17, FR-18) */}
        <Link
          href="/inbox"
          className="flex items-center gap-1.5 rounded-lg border border-purple-200 dark:border-purple-800 bg-purple-50/50 dark:bg-purple-950/20 px-3 py-1.5 text-xs font-semibold text-purple-700 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-900/40 transition shadow-xs"
          title="View Task Proposals & Inbox"
        >
          <Send className="h-3.5 w-3.5" />
          <span>Proposals</span>
        </Link>

        {/* New Task button */}
        <button
          onClick={onOpenNewTaskModal}
          className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-blue-700 transition"
        >
          <Plus className="h-4 w-4" />
          <span>New Task</span>
        </button>
      </div>
    </div>
  );
}
