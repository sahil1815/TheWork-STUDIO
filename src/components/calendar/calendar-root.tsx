"use client";

import { useState } from "react";
import { CalendarHeader } from "./calendar-header";
import { MonthView } from "./month-view";
import { WeekView } from "./week-view";
import { DayView } from "./day-view";
import { AgendaView } from "./agenda-view";
import { TaskModal } from "@/components/tasks/task-modal";
import {
  toggleTaskComplete,
  rescheduleTask,
  getCalendarTasks,
} from "@/actions/task-actions";
import {
  addMonths,
  subMonths,
  addWeeks,
  subWeeks,
  addDays,
  subDays,
  toDateString,
} from "@/lib/date-utils";

export type CalendarViewMode = "month" | "week" | "day" | "agenda";

interface TeamOption {
  id: string;
  name: string;
  role: string;
}

interface CalendarRootProps {
  initialTasks: any[];
  teams: TeamOption[];
}

export function CalendarRoot({ initialTasks, teams }: CalendarRootProps) {
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [viewMode, setViewMode] = useState<CalendarViewMode>("month");
  const [filter, setFilter] = useState<string>("all");
  const [tasks, setTasks] = useState<any[]>(initialTasks);

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<any | null>(null);
  const [modalDefaultDate, setModalDefaultDate] = useState<string>(toDateString(new Date()));
  const [modalDefaultStartTime, setModalDefaultStartTime] = useState<string | undefined>(undefined);

  const refreshTasks = async (targetFilter?: string) => {
    const updated = await getCalendarTasks(targetFilter || filter);
    setTasks(updated);
  };

  // Navigation handlers
  const handlePrev = () => {
    switch (viewMode) {
      case "month":
      case "agenda":
        setCurrentDate((d) => subMonths(d, 1));
        break;
      case "week":
        setCurrentDate((d) => subWeeks(d, 1));
        break;
      case "day":
        setCurrentDate((d) => subDays(d, 1));
        break;
    }
  };

  const handleNext = () => {
    switch (viewMode) {
      case "month":
      case "agenda":
        setCurrentDate((d) => addMonths(d, 1));
        break;
      case "week":
        setCurrentDate((d) => addWeeks(d, 1));
        break;
      case "day":
        setCurrentDate((d) => addDays(d, 1));
        break;
    }
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  const handleFilterChange = async (newFilter: string) => {
    setFilter(newFilter);
    await refreshTasks(newFilter);
  };

  // Task actions
  const handleToggleComplete = async (taskId: string) => {
    // Optimistic toggle
    setTasks((prev) =>
      prev.map((t) =>
        t.id === taskId
          ? { ...t, status: t.status === "DONE" ? "TODO" : "DONE" }
          : t
      )
    );

    const res = await toggleTaskComplete(taskId);
    if (!res.success) {
      // Rollback on error
      await refreshTasks();
    }
  };

  const handleReschedule = async (taskId: string, targetDateStr: string, targetStartTime?: string) => {
    // Optimistic reschedule
    setTasks((prev) =>
      prev.map((t) =>
        t.id === taskId
          ? {
              ...t,
              dateString: targetDateStr,
              date: new Date(targetDateStr),
              startTime: targetStartTime !== undefined ? targetStartTime : t.startTime,
            }
          : t
      )
    );

    const res = await rescheduleTask({
      taskId,
      date: targetDateStr,
      startTime: targetStartTime,
    });

    if (!res.success) {
      alert(`Could not reschedule task: ${res.error}`);
      await refreshTasks();
    }
  };

  const handleOpenNewTask = (dateStr?: string, startTime?: string) => {
    setSelectedTask(null);
    setModalDefaultDate(dateStr || toDateString(currentDate));
    setModalDefaultStartTime(startTime);
    setModalOpen(true);
  };

  const handleSelectTask = (task: any) => {
    setSelectedTask(task);
    setModalOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <CalendarHeader
        currentDate={currentDate}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        onPrev={handlePrev}
        onNext={handleNext}
        onToday={handleToday}
        filter={filter}
        onFilterChange={handleFilterChange}
        teams={teams}
        onOpenNewTaskModal={() => handleOpenNewTask()}
      />

      {/* Main View Area */}
      <div>
        {viewMode === "month" && (
          <MonthView
            currentDate={currentDate}
            tasks={tasks}
            onSelectTask={handleSelectTask}
            onDateClick={(dStr) => handleOpenNewTask(dStr)}
            onToggleComplete={handleToggleComplete}
            onRescheduleTask={handleReschedule}
          />
        )}

        {viewMode === "week" && (
          <WeekView
            currentDate={currentDate}
            tasks={tasks}
            onSelectTask={handleSelectTask}
            onDateClick={(dStr, hour) => handleOpenNewTask(dStr, hour)}
            onToggleComplete={handleToggleComplete}
            onRescheduleTask={handleReschedule}
          />
        )}

        {viewMode === "day" && (
          <DayView
            currentDate={currentDate}
            tasks={tasks}
            onSelectTask={handleSelectTask}
            onDateClick={(dStr, hour) => handleOpenNewTask(dStr, hour)}
            onToggleComplete={handleToggleComplete}
            onRescheduleTask={handleReschedule}
          />
        )}

        {viewMode === "agenda" && (
          <AgendaView
            tasks={tasks}
            onSelectTask={handleSelectTask}
            onToggleComplete={handleToggleComplete}
            onOpenNewTaskModal={() => handleOpenNewTask()}
          />
        )}
      </div>

      {/* Create / Edit Task Modal */}
      <TaskModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        taskToEdit={selectedTask}
        defaultDate={modalDefaultDate}
        defaultStartTime={modalDefaultStartTime}
        teams={teams}
        onTaskSaved={refreshTasks}
      />
    </div>
  );
}
