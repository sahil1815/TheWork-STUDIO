"use client";

import { useState } from "react";
import { getWeekDays, toDateString, isSameDay, formatTaskTiming } from "@/lib/date-utils";
import { format } from "date-fns";
import { Check, Users, MapPin } from "lucide-react";

interface WeekViewProps {
  currentDate: Date;
  tasks: any[];
  onSelectTask: (task: any) => void;
  onDateClick: (dateStr: string, startTime?: string) => void;
  onToggleComplete: (taskId: string) => void;
  onRescheduleTask: (taskId: string, targetDateStr: string, targetStartTime?: string) => void;
}

const HOURS = [
  "08:00",
  "09:00",
  "10:00",
  "11:00",
  "12:00",
  "13:00",
  "14:00",
  "15:00",
  "16:00",
  "17:00",
  "18:00",
  "19:00",
  "20:00",
];

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

  // Group tasks by date
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

  return (
    <div className="flex flex-col rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden shadow-sm">
      {/* Header Row: Days of Week */}
      <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 text-center py-2.5">
        <div className="text-xs font-medium text-zinc-400">GMT</div>
        {weekDays.map((day) => {
          const isToday = isSameDay(day, today);
          return (
            <div key={day.toISOString()} className="flex flex-col items-center">
              <span className="text-xs font-semibold text-zinc-500 uppercase">
                {format(day, "EEE")}
              </span>
              <span
                className={`mt-1 flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                  isToday
                    ? "bg-blue-600 text-white"
                    : "text-zinc-800 dark:text-zinc-200"
                }`}
              >
                {format(day, "d")}
              </span>
            </div>
          );
        })}
      </div>

      {/* All-Day Tasks Row */}
      <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b border-zinc-200 dark:border-zinc-800 min-h-[44px] bg-zinc-50/20 dark:bg-zinc-900/20">
        <div className="p-2 text-[10px] uppercase font-bold text-zinc-400 border-r border-zinc-200 dark:border-zinc-800 flex items-center justify-center">
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
              className={`p-1 space-y-1 border-r border-zinc-200 dark:border-zinc-800 transition cursor-pointer ${
                isDragTarget ? "bg-blue-50 dark:bg-blue-950/40 ring-2 ring-inset ring-blue-500" : ""
              }`}
            >
              {allDayTasks.map((task) => (
                <div
                  key={task.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, task.id)}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectTask(task);
                  }}
                  style={{ borderLeftColor: task.color || "#3b82f6" }}
                  className="flex items-center gap-1.5 px-2 py-1 rounded text-xs border-l-3 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 shadow-xs cursor-grab"
                >
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleComplete(task.id);
                    }}
                    className={`flex h-3 w-3 shrink-0 items-center justify-center rounded border ${
                      task.status === "DONE"
                        ? "bg-emerald-600 border-emerald-600 text-white"
                        : "border-zinc-400"
                    }`}
                  >
                    {task.status === "DONE" && <Check className="h-2 w-2" />}
                  </button>
                  <span className={`truncate flex-1 text-[11px] font-medium ${task.status === "DONE" ? "line-through opacity-60" : ""}`}>
                    {task.title}
                  </span>
                  {(task.team || task.teamId) && (
                    <span title={task.team?.name ? `Team: ${task.team.name}` : "Team Task"}>
                      <Users className="h-3 w-3 text-zinc-400 shrink-0" />
                    </span>
                  )}
                </div>
              ))}
            </div>
          );
        })}
      </div>

      {/* Hourly Grid */}
      <div className="divide-y divide-zinc-200 dark:divide-zinc-800 max-h-[600px] overflow-y-auto">
        {HOURS.map((hour) => {
          const hourNum = parseInt(hour.split(":")[0], 10);

          return (
            <div
              key={hour}
              className="grid grid-cols-[60px_repeat(7,1fr)] min-h-[52px] divide-x divide-zinc-200 dark:divide-zinc-800"
            >
              <div className="p-1 text-[11px] font-mono text-zinc-400 text-right pr-2 select-none">
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
                    className={`relative p-1 space-y-1 transition hover:bg-zinc-50/60 dark:hover:bg-zinc-800/40 cursor-pointer ${
                      isDragTarget ? "bg-blue-50 dark:bg-blue-950/40 ring-2 ring-inset ring-blue-500" : ""
                    }`}
                  >
                    {timedTasks.map((task) => {
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
                          className={`flex flex-col gap-0.5 p-1.5 rounded text-xs border-l-3 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 shadow-xs cursor-grab ${
                            isDone ? "opacity-60 line-through" : ""
                          }`}
                        >
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onToggleComplete(task.id);
                              }}
                              className={`flex h-3 w-3 shrink-0 items-center justify-center rounded border ${
                                isDone ? "bg-emerald-600 border-emerald-600 text-white" : "border-zinc-400"
                              }`}
                            >
                              {isDone && <Check className="h-2 w-2" />}
                            </button>
                            <span className="font-semibold truncate flex-1 text-[11px] text-zinc-900 dark:text-zinc-100">
                              {task.title}
                            </span>
                            {(task.team || task.teamId) && (
                              <span title={task.team?.name ? `Team: ${task.team.name}` : "Team Task"}>
                                <Users className="h-3 w-3 text-zinc-400 shrink-0" />
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-2 text-[10px] text-zinc-500">
                            <span>{formatTaskTiming(task.startTime, task.endTime)}</span>
                            {task.location && <MapPin className="h-2.5 w-2.5" />}
                          </div>
                        </div>
                      );
                    })}
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
