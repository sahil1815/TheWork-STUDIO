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

  const sortedDates = Object.keys(groupedTasks).sort();

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
                        className={`flex flex-col sm:flex-row sm:items-center justify-between p-4 gap-3 hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30 cursor-pointer transition ${
                          isDone ? "opacity-60 bg-zinc-50/30" : ""
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onToggleComplete(task.id);
                            }}
                            className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border transition ${
                              isDone
                                ? "bg-emerald-600 border-emerald-600 text-white"
                                : "border-zinc-400 hover:border-zinc-600 dark:border-zinc-600"
                            }`}
                          >
                            {isDone && <Check className="h-3 w-3" />}
                          </button>

                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span
                                style={{ backgroundColor: task.color || "#3b82f6" }}
                                className="h-2.5 w-2.5 rounded-full shrink-0"
                              />
                              <h4
                                className={`text-sm font-semibold text-zinc-900 dark:text-zinc-100 ${
                                  isDone ? "line-through text-zinc-500" : ""
                                }`}
                              >
                                {task.title}
                              </h4>
                            </div>

                            {task.description && (
                              <p className="text-xs text-zinc-500 line-clamp-1 pl-4">
                                {task.description}
                              </p>
                            )}

                            <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-500 pl-4 pt-0.5">
                              {task.team && (
                                <span className="flex items-center gap-1 font-medium text-blue-600 dark:text-blue-400">
                                  <Users className="h-3 w-3" />
                                  <span>{task.team.name}</span>
                                </span>
                              )}

                              {task.location && (
                                <span className="flex items-center gap-1">
                                  <MapPin className="h-3 w-3" />
                                  <span>{task.location}</span>
                                </span>
                              )}

                              <span className="flex items-center gap-1">
                                <Flag className="h-3 w-3" />
                                <span>{task.priority}</span>
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Timing badge */}
                        <div className="sm:text-right shrink-0 pl-7 sm:pl-0">
                          <span className="inline-flex items-center gap-1 text-xs font-mono font-medium px-2.5 py-1 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
                            <Clock className="h-3 w-3 text-zinc-400" />
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
