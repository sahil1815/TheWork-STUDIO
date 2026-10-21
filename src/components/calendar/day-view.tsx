"use client";

import { useState } from "react";
import { toDateString, formatTaskTiming } from "@/lib/date-utils";
import { format } from "date-fns";
import { Check, Clock, MapPin, Users, Flag, Plus, Calendar as CalendarIcon } from "lucide-react";

interface DayViewProps {
  currentDate: Date;
  tasks: any[];
  onSelectTask: (task: any) => void;
  onDateClick: (dateStr: string, startTime?: string) => void;
  onToggleComplete: (taskId: string) => void;
  onRescheduleTask: (taskId: string, targetDateStr: string, targetStartTime?: string) => void;
}

export function DayView({
  currentDate,
  tasks,
  onSelectTask,
  onDateClick,
  onToggleComplete,
  onRescheduleTask,
}: DayViewProps) {
  const dateStr = toDateString(currentDate);
  const dayTasks = tasks.filter((t) => (t.dateString || toDateString(t.date)) === dateStr);
  const allDayTasks = dayTasks.filter((t) => !t.startTime);
  const timedTasks = dayTasks.filter((t) => !!t.startTime);
  const completedCount = dayTasks.filter((t) => t.status === "DONE").length;

  const [dragOverHour, setDragOverHour] = useState<string | null>(null);

  // Derive ONLY active hours that actually contain scheduled tasks
  const activeHours = Array.from(
    new Set(
      timedTasks.map((t) => {
        const h = parseInt(t.startTime.split(":")[0], 10);
        return `${String(h).padStart(2, "0")}:00`;
      })
    )
  ).sort((a, b) => parseInt(a, 10) - parseInt(b, 10));

  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    e.dataTransfer.setData("taskId", taskId);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent, hourStr: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragOverHour !== hourStr) setDragOverHour(hourStr);
  };

  const handleDrop = (e: React.DragEvent, hourStr?: string) => {
    e.preventDefault();
    setDragOverHour(null);
    const taskId = e.dataTransfer.getData("taskId");
    if (taskId) {
      onRescheduleTask(taskId, dateStr, hourStr);
    }
  };

  // Helper for priority pill styling
  const getPriorityStyle = (priority?: string) => {
    switch (priority) {
      case "HIGH":
        return "text-rose-600 dark:text-rose-400 bg-rose-500/10 border-rose-500/20";
      case "LOW":
        return "text-blue-600 dark:text-blue-400 bg-blue-500/10 border-blue-500/20";
      default:
        return "text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/20";
    }
  };

  const renderTaskCard = (task: any, isHourly: boolean = false) => {
    const isDone = task.status === "DONE";

    return (
      <div
        key={task.id}
        draggable
        onDragStart={(e) => handleDragStart(e, task.id)}
        onClick={(e) => {
          e.stopPropagation();
          onSelectTask(task);
        }}
        style={{ borderLeftColor: task.color || "#3b82f6" }}
        className={`group relative flex flex-col justify-between p-4 rounded-xl border border-zinc-200/80 dark:border-zinc-800/80 bg-zinc-50/80 dark:bg-zinc-850/70 hover:bg-zinc-100/90 dark:hover:bg-zinc-800/90 border-l-4 transition shadow-xs hover:shadow-sm cursor-grab active:cursor-grabbing ${
          isDone ? "opacity-60" : ""
        }`}
      >
        <div className="flex items-start gap-3">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleComplete(task.id);
            }}
            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border mt-0.5 transition-all ${
              isDone
                ? "bg-emerald-600 border-emerald-600 text-white shadow-xs"
                : "border-zinc-400 dark:border-zinc-600 hover:border-zinc-600 dark:hover:border-zinc-400 bg-white dark:bg-zinc-900"
            }`}
            title={isDone ? "Mark as incomplete" : "Mark as complete"}
          >
            {isDone && <Check className="h-3.5 w-3.5 stroke-[2.5]" />}
          </button>

          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <span
                className={`text-sm sm:text-base font-semibold text-zinc-900 dark:text-zinc-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors leading-snug break-words ${
                  isDone ? "line-through text-zinc-500 dark:text-zinc-400" : ""
                }`}
              >
                {task.title}
              </span>

              {isHourly && task.startTime && (
                <span className="shrink-0 flex items-center gap-1 font-mono text-xs font-medium text-zinc-500 dark:text-zinc-400 bg-zinc-200/60 dark:bg-zinc-800 px-2 py-0.5 rounded-md">
                  <Clock className="h-3 w-3" />
                  <span>{formatTaskTiming(task.startTime, task.endTime)}</span>
                </span>
              )}
            </div>

            {task.description && (
              <p className="mt-1.5 text-xs text-zinc-600 dark:text-zinc-400 line-clamp-2 leading-relaxed">
                {task.description}
              </p>
            )}

            {/* Badges / Metadata Row */}
            <div className="flex flex-wrap items-center gap-2 mt-3 pt-2 border-t border-zinc-200/50 dark:border-zinc-800/50 text-xs">
              {!isHourly && task.startTime && (
                <span className="flex items-center gap-1 font-mono font-medium text-zinc-600 dark:text-zinc-300 bg-zinc-200/60 dark:bg-zinc-800 px-2 py-0.5 rounded-md">
                  <Clock className="h-3 w-3 text-zinc-500" />
                  <span>{formatTaskTiming(task.startTime, task.endTime)}</span>
                </span>
              )}

              {task.priority && (
                <span
                  className={`flex items-center gap-1 font-medium px-2 py-0.5 rounded-md border ${getPriorityStyle(
                    task.priority
                  )}`}
                >
                  <Flag className="h-3 w-3" />
                  <span>{task.priority}</span>
                </span>
              )}

              {(task.team || task.teamId) && (
                <span className="flex items-center gap-1 font-medium text-purple-700 dark:text-purple-300 bg-purple-500/10 border border-purple-500/20 px-2 py-0.5 rounded-md">
                  <Users className="h-3 w-3" />
                  <span>{task.team?.name || "Team Task"}</span>
                </span>
              )}

              {task.location && (
                <span className="flex items-center gap-1 text-zinc-500 dark:text-zinc-400 px-1 py-0.5">
                  <MapPin className="h-3 w-3 text-zinc-400" />
                  <span className="truncate max-w-[140px]">{task.location}</span>
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden shadow-sm">
      {/* Date banner */}
      <div className="p-4 sm:p-5 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-zinc-900 dark:text-zinc-50 tracking-tight">
            {format(currentDate, "EEEE, MMMM d, yyyy")}
          </h2>
          <div className="flex items-center gap-2 text-xs sm:text-sm text-zinc-500 mt-1">
            <span>
              {dayTasks.length} {dayTasks.length === 1 ? "task" : "tasks"} scheduled
            </span>
            {dayTasks.length > 0 && (
              <>
                <span>•</span>
                <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                  {completedCount} completed
                </span>
                {dayTasks.length - completedCount > 0 && (
                  <>
                    <span>•</span>
                    <span className="text-blue-600 dark:text-blue-400 font-medium">
                      {dayTasks.length - completedCount} remaining
                    </span>
                  </>
                )}
              </>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={() => onDateClick(dateStr)}
          className="inline-flex items-center gap-1.5 self-start sm:self-auto rounded-lg bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-blue-700 transition"
        >
          <Plus className="h-4 w-4" />
          <span>Add Task</span>
        </button>
      </div>

      {/* Empty State when no tasks exist on this day */}
      {dayTasks.length === 0 && (
        <div className="p-12 sm:p-16 text-center flex flex-col items-center justify-center space-y-4 min-h-[380px]">
          <div className="h-14 w-14 rounded-2xl bg-zinc-100 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 flex items-center justify-center text-zinc-400">
            <CalendarIcon className="h-7 w-7" />
          </div>
          <div>
            <h3 className="text-base sm:text-lg font-bold text-zinc-900 dark:text-zinc-100">
              No tasks scheduled for this day
            </h3>
            <p className="text-xs sm:text-sm text-zinc-500 max-w-sm mx-auto mt-1">
              You have a clear schedule for {format(currentDate, "MMMM d")}. Click below to add a new task.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onDateClick(dateStr)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-blue-700 transition"
          >
            <Plus className="h-4 w-4" />
            <span>Create a Task</span>
          </button>
        </div>
      )}

      {/* All-Day Tasks section */}
      {allDayTasks.length > 0 && (
        <div
          onDragOver={(e) => handleDragOver(e, "allday")}
          onDragLeave={() => setDragOverHour(null)}
          onDrop={(e) => handleDrop(e, undefined)}
          className={`p-4 sm:p-6 space-y-3 ${
            dragOverHour === "allday" ? "bg-blue-50/50 dark:bg-blue-950/30 ring-2 ring-inset ring-blue-500" : ""
          }`}
        >
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              All-Day Tasks ({allDayTasks.length})
            </h3>
            <span className="text-xs text-zinc-400 font-medium hidden sm:inline">
              Drag & drop to reschedule
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {allDayTasks.map((task) => renderTaskCard(task, false))}
          </div>
        </div>
      )}

      {/* Timed Tasks Timeline (Only rows for timestamps with tasks are shown) */}
      {activeHours.length > 0 && (
        <div
          className={`p-4 sm:p-6 space-y-3 ${
            allDayTasks.length > 0 ? "border-t border-zinc-200 dark:border-zinc-800" : ""
          }`}
        >
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Scheduled Timeline ({timedTasks.length})
            </h3>
            <span className="text-xs text-zinc-400 font-medium hidden sm:inline">
              Only showing times with active tasks
            </span>
          </div>

          <div className="divide-y divide-zinc-200 dark:divide-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden bg-white dark:bg-zinc-900/50">
            {activeHours.map((hour) => {
              const hourNum = parseInt(hour.split(":")[0], 10);
              const tasksAtHour = timedTasks
                .filter((t) => parseInt(t.startTime.split(":")[0], 10) === hourNum)
                .sort((a, b) => (a.startTime || "").localeCompare(b.startTime || ""));

              const isDragTarget = dragOverHour === hour;

              return (
                <div
                  key={hour}
                  onClick={() => onDateClick(dateStr, hour)}
                  onDragOver={(e) => handleDragOver(e, hour)}
                  onDragLeave={() => setDragOverHour(null)}
                  onDrop={(e) => handleDrop(e, hour)}
                  className={`flex flex-col sm:flex-row transition cursor-pointer ${
                    isDragTarget
                      ? "bg-blue-50 dark:bg-blue-950/40 ring-2 ring-inset ring-blue-500"
                      : "hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30"
                  }`}
                >
                  {/* Hour gutter */}
                  <div className="w-full sm:w-24 p-3 sm:p-4 text-left sm:text-right text-xs sm:text-sm font-mono font-bold text-zinc-500 dark:text-zinc-400 select-none border-b sm:border-b-0 sm:border-r border-zinc-200 dark:border-zinc-800 shrink-0 bg-zinc-50/40 dark:bg-zinc-900/60 flex items-center justify-between sm:justify-end">
                    <span>{hour}</span>
                    <span className="sm:hidden text-[11px] text-zinc-400 font-sans font-normal">
                      {tasksAtHour.length} {tasksAtHour.length === 1 ? "task" : "tasks"}
                    </span>
                  </div>

                  {/* Task slot */}
                  <div className="flex-1 p-3 sm:p-4 space-y-2">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {tasksAtHour.map((task) => renderTaskCard(task, true))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
