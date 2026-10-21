"use client";

import { useState } from "react";
import { toDateString, formatTaskTiming } from "@/lib/date-utils";
import { format, parseISO } from "date-fns";
import { Check, Clock, MapPin, Users, Flag, Calendar as CalendarIcon, Search } from "lucide-react";

interface AgendaViewProps {
  tasks: any[];
  onSelectTask: (task: any) => void;
  onToggleComplete: (taskId: string) => void;
  onOpenNewTaskModal: () => void;
}

export function AgendaView({
  tasks,
  onSelectTask,
  onToggleComplete,
  onOpenNewTaskModal,
}: AgendaViewProps) {
  const [search, setSearch] = useState("");

  const filteredTasks = tasks.filter((t) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      t.title.toLowerCase().includes(q) ||
      (t.description && t.description.toLowerCase().includes(q)) ||
      (t.location && t.location.toLowerCase().includes(q)) ||
      (t.team && t.team.name.toLowerCase().includes(q))
    );
  });

  // Group by date
  const groupedTasks = filteredTasks.reduce<Record<string, any[]>>((acc, task) => {
    const dStr = task.dateString || toDateString(task.date);
    if (!acc[dStr]) acc[dStr] = [];
    acc[dStr].push(task);
    return acc;
  }, {});

  // Reverse chronological sorting: newest dates first, older dates at the bottom
  const sortedDates = Object.keys(groupedTasks).sort((a, b) => b.localeCompare(a));

  const getPriorityStyle = (priority?: string) => {
    switch (priority) {
      case "HIGH":
        return "text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/60 border-rose-200 dark:border-rose-800/60";
      case "LOW":
        return "text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 border-blue-200 dark:border-blue-800/60";
      default:
        return "text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60 border-amber-200 dark:border-amber-800/60";
    }
  };

  return (
    <div className="space-y-4">
      {/* Search Bar */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filter agenda tasks by title, team, location..."
          className="w-full rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 py-2 pl-9 pr-3 text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 shadow-sm"
        />
      </div>

      {sortedDates.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-300 dark:border-zinc-800 p-12 text-center space-y-3 bg-white dark:bg-zinc-900">
          <CalendarIcon className="mx-auto h-10 w-10 text-zinc-400" />
          <h3 className="text-base font-semibold text-zinc-800 dark:text-zinc-200">
            No scheduled tasks found
          </h3>
          <p className="text-sm text-zinc-500 max-w-sm mx-auto">
            {search
              ? "No tasks matched your search query."
              : "You have no upcoming tasks on your agenda."}
          </p>
          <button
            onClick={onOpenNewTaskModal}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-blue-700 transition"
          >
            Create Your First Task
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {sortedDates.map((dateStr) => {
            const dateObj = parseISO(dateStr);
            const dateTasks = groupedTasks[dateStr];

            return (
              <div
                key={dateStr}
                className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden shadow-sm"
              >
                {/* Date Header */}
                <div className="px-4 py-3 bg-zinc-50/60 dark:bg-zinc-800/40 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
                  <span className="font-bold text-sm text-zinc-900 dark:text-zinc-100">
                    {format(dateObj, "EEEE, MMMM d, yyyy")}
                  </span>
                  <span className="text-xs text-zinc-500 font-medium">
                    {dateTasks.length} {dateTasks.length === 1 ? "item" : "items"}
                  </span>
                </div>

                {/* Task Rows */}
                <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {dateTasks.map((task) => {
                    const isDone = task.status === "DONE";
                    return (
                      <div
                        key={task.id}
                        onClick={() => onSelectTask(task)}
                        className={`flex flex-col sm:flex-row sm:items-center justify-between p-4 gap-3 cursor-pointer transition ${
                          isDone
                            ? "bg-zinc-50/50 dark:bg-zinc-900/60 hover:bg-zinc-100/70 dark:hover:bg-zinc-800/50"
                            : "bg-white dark:bg-zinc-900 hover:bg-zinc-50/80 dark:hover:bg-zinc-800/50"
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onToggleComplete(task.id);
                            }}
                            className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-all ${
                              isDone
                                ? "bg-emerald-600 border-emerald-600 text-white shadow-xs"
                                : "border-zinc-300 dark:border-zinc-600 hover:border-zinc-500 dark:hover:border-zinc-400 bg-white dark:bg-zinc-900"
                            }`}
                            title={isDone ? "Mark as incomplete" : "Mark as complete"}
                          >
                            {isDone && <Check className="h-3 w-3 stroke-[2.5]" />}
                          </button>

                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span
                                style={{ backgroundColor: task.color || "#3b82f6" }}
                                className={`h-2.5 w-2.5 rounded-full shrink-0 ${isDone ? "opacity-60" : ""}`}
                              />
                              <h4
                                className={`text-sm font-semibold transition-colors ${
                                  isDone
                                    ? "line-through text-zinc-400 dark:text-zinc-400 font-normal"
                                    : "text-zinc-900 dark:text-zinc-100 hover:text-blue-600 dark:hover:text-blue-400"
                                }`}
                              >
                                {task.title}
                              </h4>
                              {(task.team || task.teamId) && (
                                <span title={task.team?.name ? `Team: ${task.team.name}` : "Team Task"}>
                                  <Users className="h-3.5 w-3.5 text-zinc-400 dark:text-zinc-500 shrink-0" />
                                </span>
                              )}
                            </div>

                            {task.description && (
                              <p
                                className={`text-xs line-clamp-1 pl-4.5 ${
                                  isDone
                                    ? "text-zinc-400 dark:text-zinc-500"
                                    : "text-zinc-600 dark:text-zinc-300"
                                }`}
                              >
                                {task.description}
                              </p>
                            )}

                            <div className="flex flex-wrap items-center gap-2 text-xs pl-4.5 pt-1">
                              {(task.team || task.teamId) && (
                                <span
                                  className="inline-flex items-center gap-1 font-medium text-[11px] px-2 py-0.5 rounded-md border text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/60 border-purple-200 dark:border-purple-800/60"
                                  title={task.team?.name ? `Team: ${task.team.name}` : "Team Task"}
                                >
                                  <Users className="h-3 w-3 shrink-0" />
                                  <span className="truncate max-w-[140px]">{task.team?.name || "Team Task"}</span>
                                </span>
                              )}

                              {task.priority && (
                                <span
                                  className={`inline-flex items-center gap-1 font-medium text-[11px] px-2 py-0.5 rounded-md border ${getPriorityStyle(
                                    task.priority
                                  )}`}
                                >
                                  <Flag className="h-3 w-3" />
                                  <span>{task.priority}</span>
                                </span>
                              )}

                              {task.location && (
                                <span className="inline-flex items-center gap-1 text-[11px] text-zinc-500 dark:text-zinc-400 px-1 py-0.5">
                                  <MapPin className="h-3 w-3 text-zinc-400 dark:text-zinc-500" />
                                  <span className="truncate max-w-[140px]">{task.location}</span>
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Timing badge */}
                        <div className="sm:text-right shrink-0 pl-7 sm:pl-0">
                          <span
                            className={`inline-flex items-center gap-1.5 text-xs font-mono font-medium px-2.5 py-1 rounded-md border shadow-xs ${
                              isDone
                                ? "bg-zinc-100/70 dark:bg-zinc-800/70 text-zinc-500 dark:text-zinc-400 border-zinc-200/60 dark:border-zinc-700/60"
                                : "bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 border-zinc-200 dark:border-zinc-700"
                            }`}
                          >
                            <Clock className="h-3 w-3 text-zinc-400 dark:text-zinc-400" />
                            <span>{formatTaskTiming(task.startTime, task.endTime)}</span>
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
