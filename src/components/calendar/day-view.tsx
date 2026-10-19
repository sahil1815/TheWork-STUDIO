"use client";

import { useState } from "react";
import { toDateString, formatTaskTiming } from "@/lib/date-utils";
import { format } from "date-fns";
import { Check, Clock, MapPin, Users, AlignLeft, Flag } from "lucide-react";

interface DayViewProps {
  currentDate: Date;
  tasks: any[];
  onSelectTask: (task: any) => void;
  onDateClick: (dateStr: string, startTime?: string) => void;
  onToggleComplete: (taskId: string) => void;
  onRescheduleTask: (taskId: string, targetDateStr: string, targetStartTime?: string) => void;
}

const HOURS = [
  "07:00",
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
  "21:00",
];

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

  const [dragOverHour, setDragOverHour] = useState<string | null>(null);

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

  return (
    <div className="flex flex-col rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden shadow-sm">
      {/* Date banner */}
      <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
            {format(currentDate, "EEEE, MMMM d, yyyy")}
          </h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            {dayTasks.length} {dayTasks.length === 1 ? "task" : "tasks"} scheduled
          </p>
        </div>
      </div>

      {/* All-Day Tasks section */}
      {allDayTasks.length > 0 && (
        <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/20 space-y-2">
          <span className="text-xs uppercase font-bold text-zinc-500 tracking-wider">
            All-Day Tasks
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
            {allDayTasks.map((task) => (
              <div
                key={task.id}
                onClick={() => onSelectTask(task)}
                style={{ borderLeftColor: task.color || "#3b82f6" }}
                className="flex items-center justify-between p-3 rounded-lg border-l-4 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 cursor-pointer shadow-xs transition"
              >
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleComplete(task.id);
                    }}
                    className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                      task.status === "DONE"
                        ? "bg-emerald-600 border-emerald-600 text-white"
                        : "border-zinc-400"
                    }`}
                  >
                    {task.status === "DONE" && <Check className="h-3 w-3" />}
                  </button>
                  <span className={`text-sm font-semibold ${task.status === "DONE" ? "line-through opacity-60" : ""}`}>
                    {task.title}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Hourly timeline */}
      <div className="divide-y divide-zinc-200 dark:divide-zinc-800 max-h-[650px] overflow-y-auto">
        {HOURS.map((hour) => {
          const hourNum = parseInt(hour.split(":")[0], 10);
          const tasksAtHour = dayTasks.filter((t) => {
            if (!t.startTime) return false;
            return parseInt(t.startTime.split(":")[0], 10) === hourNum;
          });

          const isDragTarget = dragOverHour === hour;

          return (
            <div
              key={hour}
              onClick={() => onDateClick(dateStr, hour)}
              onDragOver={(e) => handleDragOver(e, hour)}
              onDragLeave={() => setDragOverHour(null)}
              onDrop={(e) => handleDrop(e, hour)}
              className={`flex min-h-[64px] transition cursor-pointer ${
                isDragTarget ? "bg-blue-50 dark:bg-blue-950/40 ring-2 ring-inset ring-blue-500" : "hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30"
              }`}
            >
              {/* Hour gutter */}
              <div className="w-20 p-2 text-right text-xs font-mono text-zinc-400 select-none border-r border-zinc-200 dark:border-zinc-800 shrink-0">
                {hour}
              </div>

              {/* Task slot */}
              <div className="flex-1 p-2 space-y-2">
                {tasksAtHour.map((task) => {
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
                      className={`p-3 rounded-lg border-l-4 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 shadow-sm cursor-grab active:cursor-grabbing transition ${
                        isDone ? "opacity-60 line-through" : ""
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onToggleComplete(task.id);
                            }}
                            className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                              isDone ? "bg-emerald-600 border-emerald-600 text-white" : "border-zinc-400"
                            }`}
                          >
                            {isDone && <Check className="h-3 w-3" />}
                          </button>
                          <span className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                            {task.title}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 text-xs text-zinc-500 font-mono">
                          <Clock className="h-3.5 w-3.5" />
                          <span>{formatTaskTiming(task.startTime, task.endTime)}</span>
                        </div>
                      </div>

                      {/* Metadata */}
                      <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-zinc-600 dark:text-zinc-400">
                        {task.team && (
                          <span className="flex items-center gap-1 font-medium text-blue-600 dark:text-blue-400">
                            <Users className="h-3.5 w-3.5" />
                            <span>{task.team.name}</span>
                          </span>
                        )}

                        {task.location && (
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3.5 w-3.5" />
                            <span>{task.location}</span>
                          </span>
                        )}

                        <span className="flex items-center gap-1">
                          <Flag className="h-3.5 w-3.5" />
                          <span>Priority: {task.priority}</span>
                        </span>
                      </div>

                      {task.description && (
                        <p className="mt-1.5 text-xs text-zinc-600 dark:text-zinc-400 line-clamp-2">
                          {task.description}
                        </p>
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
