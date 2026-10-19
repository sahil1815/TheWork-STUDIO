"use client";

import { useState } from "react";
import { getMonthDays, toDateString, isSameMonth, isSameDay, formatTaskTiming } from "@/lib/date-utils";
import { format } from "date-fns";
import { Check, Clock, Users } from "lucide-react";

interface MonthViewProps {
  currentDate: Date;
  tasks: any[];
  onSelectTask: (task: any) => void;
  onDateClick: (dateStr: string) => void;
  onToggleComplete: (taskId: string) => void;
  onRescheduleTask: (taskId: string, targetDateStr: string) => void;
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function MonthView({
  currentDate,
  tasks,
  onSelectTask,
  onDateClick,
  onToggleComplete,
  onRescheduleTask,
}: MonthViewProps) {
  const days = getMonthDays(currentDate);
  const today = new Date();

  const [dragOverDate, setDragOverDate] = useState<string | null>(null);

  // Group tasks by date string
  const tasksByDate = tasks.reduce<Record<string, any[]>>((acc, task) => {
    const dStr = task.dateString || toDateString(task.date);
    if (!acc[dStr]) acc[dStr] = [];
    acc[dStr].push(task);
    return acc;
  }, {});

  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    e.dataTransfer.setData("taskId", taskId);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent, dateStr: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragOverDate !== dateStr) {
      setDragOverDate(dateStr);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOverDate(null);
  };

  const handleDrop = (e: React.DragEvent, targetDateStr: string) => {
    e.preventDefault();
    setDragOverDate(null);
    const taskId = e.dataTransfer.getData("taskId");
    if (taskId) {
      onRescheduleTask(taskId, targetDateStr);
    }
  };

  return (
    <div className="flex flex-col rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden shadow-sm">
      {/* Weekday headers */}
      <div className="grid grid-cols-7 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 text-center text-xs font-semibold text-zinc-600 dark:text-zinc-400 py-2.5">
        {WEEKDAYS.map((day) => (
          <div key={day}>{day}</div>
        ))}
      </div>

      {/* Days grid */}
      <div className="grid grid-cols-7 auto-rows-[minmax(110px,1fr)] divide-x divide-y divide-zinc-200 dark:divide-zinc-800 border-b border-zinc-200 dark:border-zinc-800">
        {days.map((day) => {
          const dateStr = toDateString(day);
          const dayTasks = tasksByDate[dateStr] || [];
          const isCurrentMonth = isSameMonth(day, currentDate);
          const isTodayDate = isSameDay(day, today);
          const isDragTarget = dragOverDate === dateStr;

          return (
            <div
              key={dateStr}
              onClick={() => onDateClick(dateStr)}
              onDragOver={(e) => handleDragOver(e, dateStr)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, dateStr)}
              className={`group relative flex flex-col p-1.5 transition cursor-pointer select-none ${
                !isCurrentMonth ? "bg-zinc-50/40 dark:bg-zinc-950/40 text-zinc-400 dark:text-zinc-600" : ""
              } ${isDragTarget ? "bg-blue-50/70 dark:bg-blue-950/40 ring-2 ring-inset ring-blue-500" : "hover:bg-zinc-50/60 dark:hover:bg-zinc-800/40"}`}
            >
              {/* Day Number Header */}
              <div className="flex items-center justify-between mb-1">
                <span
                  className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium ${
                    isTodayDate
                      ? "bg-blue-600 text-white font-bold"
                      : "text-zinc-700 dark:text-zinc-300"
                  }`}
                >
                  {format(day, "d")}
                </span>

                {dayTasks.length > 3 && (
                  <span className="text-[10px] text-zinc-400 font-medium pr-1">
                    +{dayTasks.length - 3} more
                  </span>
                )}
              </div>

              {/* Task Chips */}
              <div className="flex-1 space-y-1 overflow-y-auto max-h-[90px] pr-0.5">
                {dayTasks.slice(0, 4).map((task) => {
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
                      className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs border-l-3 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 shadow-xs cursor-grab active:cursor-grabbing transition ${
                        isDone ? "opacity-60 line-through" : ""
                      }`}
                      title={`${task.title} (${formatTaskTiming(task.startTime, task.endTime)})`}
                    >
                      {/* Checkbox toggle */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleComplete(task.id);
                        }}
                        className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border transition ${
                          isDone
                            ? "bg-emerald-600 border-emerald-600 text-white"
                            : "border-zinc-400 hover:border-zinc-600 dark:border-zinc-600"
                        }`}
                      >
                        {isDone && <Check className="h-2.5 w-2.5" />}
                      </button>

                      <span className="truncate flex-1 font-medium text-[11px] text-zinc-900 dark:text-zinc-100">
                        {task.title}
                      </span>

                      {task.team && (
                        <span title={`Team: ${task.team.name}`}>
                          <Users className="h-3 w-3 text-zinc-400 shrink-0" />
                        </span>
                      )}

                      {task.startTime && (
                        <span className="text-[9px] text-zinc-500 font-mono shrink-0">
                          {task.startTime}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
