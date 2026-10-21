"use client";

import { useState } from "react";
import { getWeekDays, toDateString, isSameDay, formatTaskTiming } from "@/lib/date-utils";
import { format } from "date-fns";
import { Check, Users, MapPin, Flag, Plus, Clock, Calendar as CalendarIcon } from "lucide-react";

interface WeekViewProps {
  currentDate: Date;
  tasks: any[];
  onSelectTask: (task: any) => void;
  onDateClick: (dateStr: string, startTime?: string) => void;
  onToggleComplete: (taskId: string) => void;
  onRescheduleTask: (taskId: string, targetDateStr: string, targetStartTime?: string) => void;
}

export function WeekView({
  currentDate,
  tasks,
  onSelectTask,
  onDateClick,
  onToggleComplete,
  onRescheduleTask,
}: WeekViewProps) {
  const weekDays = getWeekDays(currentDate);
  const today = new Date();

  const [dragOverKey, setDragOverKey] = useState<string | null>(null);

  // Group tasks by date string
  const tasksByDate = tasks.reduce<Record<string, any[]>>((acc, task) => {
    const dStr = task.dateString || toDateString(task.date);
    if (!acc[dStr]) acc[dStr] = [];
    acc[dStr].push(task);
    return acc;
  }, {});

  // All tasks occurring within the visible week
  const weekDateStrs = new Set(weekDays.map((d) => toDateString(d)));
  const allWeekTasks = tasks.filter((t) => {
    const dStr = t.dateString || toDateString(t.date);
    return weekDateStrs.has(dStr);
  });

  const timedTasksInWeek = allWeekTasks.filter((t) => !!t.startTime);
  const allDayTasksInWeek = allWeekTasks.filter((t) => !t.startTime);

  // Derive ONLY the active hours across the week that have scheduled tasks
  const activeHours = Array.from(
    new Set(
      timedTasksInWeek.map((t) => {
        const h = parseInt(t.startTime.split(":")[0], 10);
        return `${String(h).padStart(2, "0")}:00`;
      })
    )
  ).sort((a, b) => parseInt(a, 10) - parseInt(b, 10));

  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    e.dataTransfer.setData("taskId", taskId);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent, key: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragOverKey !== key) {
      setDragOverKey(key);
    }
  };

  const handleDrop = (e: React.DragEvent, dateStr: string, hourStr?: string) => {
    e.preventDefault();
    setDragOverKey(null);
    const taskId = e.dataTransfer.getData("taskId");
    if (taskId) {
      onRescheduleTask(taskId, dateStr, hourStr);
    }
  };

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
        className={`group relative flex flex-col gap-1.5 p-2.5 rounded-lg border border-zinc-200/80 dark:border-zinc-750 bg-white dark:bg-zinc-800/90 hover:bg-zinc-50 dark:hover:bg-zinc-750 border-l-4 transition-all shadow-xs hover:shadow-sm cursor-grab active:cursor-grabbing ${
          isDone ? "opacity-60" : ""
        }`}
      >
        <div className="flex items-start gap-2">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleComplete(task.id);
            }}
            className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border mt-0.5 transition-all ${
              isDone
                ? "bg-emerald-600 border-emerald-600 text-white"
                : "border-zinc-400 dark:border-zinc-500 hover:border-zinc-600 dark:hover:border-zinc-300 bg-white dark:bg-zinc-900"
            }`}
            title={isDone ? "Mark as incomplete" : "Mark as complete"}
          >
            {isDone && <Check className="h-2.5 w-2.5 stroke-[2.5]" />}
          </button>

          <span
            className={`flex-1 text-xs sm:text-sm font-semibold text-zinc-900 dark:text-zinc-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors leading-snug break-words ${
              isDone ? "line-through text-zinc-500 dark:text-zinc-400" : ""
            }`}
          >
            {task.title}
          </span>
        </div>

        {/* Task Metadata Row */}
        <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-zinc-500 dark:text-zinc-400 pl-6">
          {task.startTime && (
            <span className="flex items-center gap-1 font-mono font-medium text-[10px] text-zinc-600 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-700/80 px-1.5 py-0.5 rounded">
              <Clock className="h-2.5 w-2.5" />
              <span>{formatTaskTiming(task.startTime, task.endTime)}</span>
            </span>
          )}

          {task.priority && task.priority !== "MEDIUM" && (
            <span
              className={`flex items-center gap-0.5 font-medium text-[10px] px-1.5 py-0.5 rounded border ${getPriorityStyle(
                task.priority
              )}`}
            >
              <Flag className="h-2.5 w-2.5" />
              <span>{task.priority}</span>
            </span>
          )}

          {(task.team || task.teamId) && (
            <span
              className="flex items-center gap-0.5 font-medium text-[10px] text-purple-700 dark:text-purple-300 bg-purple-500/10 border border-purple-500/20 px-1.5 py-0.5 rounded truncate max-w-[120px]"
              title={task.team?.name ? `Team: ${task.team.name}` : "Team Task"}
            >
              <Users className="h-2.5 w-2.5 shrink-0" />
              <span className="truncate">{task.team?.name || "Team"}</span>
            </span>
          )}

          {task.location && (
            <span className="flex items-center gap-0.5 text-[10px] text-zinc-500 dark:text-zinc-400">
              <MapPin className="h-2.5 w-2.5 shrink-0" />
              <span className="truncate max-w-[80px]">{task.location}</span>
            </span>
          )}
        </div>
      </div>
    );
  };

  // -------------------------------------------------------------
  // VIEW MODE A: No Timed Tasks Across the Entire Week (e.g. All-Day or Empty)
  // Clean 7-column layout that spans full width without empty hourly rows
  // -------------------------------------------------------------
  if (activeHours.length === 0) {
    return (
      <div className="flex flex-col rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden shadow-sm">
        {/* Weekday Column Headers */}
        <div className="grid grid-cols-7 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 text-center py-3 divide-x divide-zinc-200 dark:border-zinc-800">
          {weekDays.map((day) => {
            const isToday = isSameDay(day, today);
            const dateStr = toDateString(day);
            const count = (tasksByDate[dateStr] || []).length;

            return (
              <div key={day.toISOString()} className="flex flex-col items-center px-1">
                <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider">
                  {format(day, "EEE")}
                </span>
                <span
                  className={`mt-1 flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition ${
                    isToday
                      ? "bg-blue-600 text-white shadow-xs"
                      : "text-zinc-800 dark:text-zinc-200 hover:bg-zinc-200/50 dark:hover:bg-zinc-800"
                  }`}
                >
                  {format(day, "d")}
                </span>
                {count > 0 && (
                  <span className="text-[10px] font-medium text-zinc-400 dark:text-zinc-500 mt-0.5">
                    {count} {count === 1 ? "task" : "tasks"}
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* 7-Day Columns Body (Spacious, fills view, no empty hourly rows) */}
        <div className="grid grid-cols-7 divide-x divide-zinc-200 dark:divide-zinc-800 min-h-[540px]">
          {weekDays.map((day) => {
            const dateStr = toDateString(day);
            const dayTasks = tasksByDate[dateStr] || [];
            const dropKey = `${dateStr}-col`;
            const isDragTarget = dragOverKey === dropKey;

            return (
              <div
                key={dateStr}
                onClick={() => onDateClick(dateStr)}
                onDragOver={(e) => handleDragOver(e, dropKey)}
                onDragLeave={() => setDragOverKey(null)}
                onDrop={(e) => handleDrop(e, dateStr)}
                className={`p-2.5 space-y-2 flex flex-col justify-between transition group/col cursor-pointer ${
                  isDragTarget
                    ? "bg-blue-50/70 dark:bg-blue-950/40 ring-2 ring-inset ring-blue-500"
                    : "hover:bg-zinc-50/40 dark:hover:bg-zinc-800/10"
                }`}
              >
                {/* Task Stack */}
                <div className="space-y-2">
                  {dayTasks.map((task) => renderTaskCard(task, false))}

                  {dayTasks.length === 0 && (
                    <div className="py-12 flex flex-col items-center justify-center text-center opacity-0 group-hover/col:opacity-100 transition-opacity">
                      <Plus className="h-5 w-5 text-zinc-400/70" />
                      <span className="text-xs text-zinc-400 mt-1">Click to add</span>
                    </div>
                  )}
                </div>

                {/* Add Task Button at bottom of column */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDateClick(dateStr);
                  }}
                  className="w-full py-1.5 text-xs font-medium text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 border border-dashed border-zinc-200 dark:border-zinc-800 opacity-0 group-hover/col:opacity-100 transition flex items-center justify-center gap-1 mt-auto"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Add task</span>
                </button>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // VIEW MODE B: Active Timed Tasks Exist
  // Render ONLY rows for the specific timestamps that contain tasks!
  // Zero empty timestamp rows are displayed.
  // -------------------------------------------------------------
  return (
    <div className="flex flex-col rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden shadow-sm">
      {/* Header Row: Days of Week */}
      <div className="grid grid-cols-[64px_repeat(7,1fr)] divide-x divide-zinc-200 dark:divide-zinc-800 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 text-center py-2.5">
        <div className="text-xs font-bold text-zinc-400 uppercase tracking-wider flex items-center justify-center">
          GMT
        </div>
        {weekDays.map((day) => {
          const isToday = isSameDay(day, today);
          const dateStr = toDateString(day);
          const count = (tasksByDate[dateStr] || []).length;

          return (
            <div key={day.toISOString()} className="flex flex-col items-center px-1">
              <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider">
                {format(day, "EEE")}
              </span>
              <span
                className={`mt-1 flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                  isToday
                    ? "bg-blue-600 text-white shadow-xs"
                    : "text-zinc-800 dark:text-zinc-200"
                }`}
              >
                {format(day, "d")}
              </span>
              {count > 0 && (
                <span className="text-[10px] font-medium text-zinc-400 dark:text-zinc-500 mt-0.5">
                  {count} {count === 1 ? "task" : "tasks"}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* All-Day Tasks Row (Only rendered if all-day tasks exist) */}
      {allDayTasksInWeek.length > 0 && (
        <div className="grid grid-cols-[64px_repeat(7,1fr)] divide-x divide-zinc-200 dark:divide-zinc-800 border-b border-zinc-200 dark:border-zinc-800 min-h-[56px] bg-zinc-50/20 dark:bg-zinc-900/20">
          <div className="p-2 text-[11px] uppercase font-bold text-zinc-400 flex items-center justify-center select-none text-center leading-tight">
            All-day
          </div>
          {weekDays.map((day) => {
            const dateStr = toDateString(day);
            const allDayTasks = (tasksByDate[dateStr] || []).filter((t) => !t.startTime);
            const dropKey = `${dateStr}-allday`;
            const isDragTarget = dragOverKey === dropKey;

            return (
              <div
                key={dropKey}
                onClick={() => onDateClick(dateStr)}
                onDragOver={(e) => handleDragOver(e, dropKey)}
                onDragLeave={() => setDragOverKey(null)}
                onDrop={(e) => handleDrop(e, dateStr)}
                className={`p-2 space-y-1.5 transition cursor-pointer ${
                  isDragTarget ? "bg-blue-50 dark:bg-blue-950/40 ring-2 ring-inset ring-blue-500" : "hover:bg-zinc-50/40 dark:hover:bg-zinc-800/10"
                }`}
              >
                {allDayTasks.map((task) => renderTaskCard(task, false))}
              </div>
            );
          })}
        </div>
      )}

      {/* Scheduled Timed Rows (ONLY rendered for activeHours that have tasks!) */}
      <div className="divide-y divide-zinc-200 dark:divide-zinc-800 min-h-[400px]">
        {activeHours.map((hour) => {
          const hourNum = parseInt(hour.split(":")[0], 10);

          return (
            <div
              key={hour}
              className="grid grid-cols-[64px_repeat(7,1fr)] min-h-[72px] divide-x divide-zinc-200 dark:divide-zinc-800"
            >
              <div className="p-2 text-xs font-mono font-bold text-zinc-400 flex items-center justify-center select-none bg-zinc-50/30 dark:bg-zinc-900/40">
                {hour}
              </div>

              {weekDays.map((day) => {
                const dateStr = toDateString(day);
                const timedTasks = (tasksByDate[dateStr] || []).filter((t) => {
                  if (!t.startTime) return false;
                  const tHour = parseInt(t.startTime.split(":")[0], 10);
                  return tHour === hourNum;
                });

                const slotKey = `${dateStr}-${hour}`;
                const isDragTarget = dragOverKey === slotKey;

                return (
                  <div
                    key={slotKey}
                    onClick={() => onDateClick(dateStr, hour)}
                    onDragOver={(e) => handleDragOver(e, slotKey)}
                    onDragLeave={() => setDragOverKey(null)}
                    onDrop={(e) => handleDrop(e, dateStr, hour)}
                    className={`relative p-2 space-y-1.5 transition hover:bg-zinc-50/60 dark:hover:bg-zinc-800/40 cursor-pointer ${
                      isDragTarget ? "bg-blue-50 dark:bg-blue-950/40 ring-2 ring-inset ring-blue-500" : ""
                    }`}
                  >
                    {timedTasks.map((task) => renderTaskCard(task, true))}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
