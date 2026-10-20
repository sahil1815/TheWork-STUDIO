"use client";

import { useState, useEffect } from "react";
import { TaskStatus, TaskPriority } from "@prisma/client";
import { createBatchTasks, updateTask, deleteTask } from "@/actions/task-actions";
import { toDateString } from "@/lib/date-utils";
import {
  X,
  Calendar,
  Clock,
  MapPin,
  AlignLeft,
  Tag,
  Trash2,
  AlertCircle,
  Plus,
  Copy,
  ChevronDown,
  ChevronUp,
  Layers,
  Users,
} from "lucide-react";

interface TeamOption {
  id: string;
  name: string;
  role: string;
}

interface TaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  taskToEdit?: any | null;
  defaultDate?: string;
  defaultStartTime?: string;
  teams?: TeamOption[];
  onTaskSaved?: () => void;
}

export interface TaskDraft {
  id: string;
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  location: string;
  color: string;
  teamId: string; // "" = Personal Task (No Team)
  isExpanded: boolean;
}

const COLOR_OPTIONS = [
  { label: "Blue", value: "#3b82f6" },
  { label: "Emerald", value: "#10b981" },
  { label: "Purple", value: "#8b5cf6" },
  { label: "Amber", value: "#f59e0b" },
  { label: "Rose", value: "#f43f5e" },
  { label: "Cyan", value: "#06b6d4" },
];

function createEmptyDraft(defaultDate?: string, defaultStartTime?: string, teamId: string = ""): TaskDraft {
  return {
    id: Math.random().toString(36).substring(2, 9),
    title: "",
    date: defaultDate || toDateString(new Date()),
    startTime: defaultStartTime || "",
    endTime: "",
    description: "",
    status: TaskStatus.TODO,
    priority: TaskPriority.MEDIUM,
    location: "",
    color: "#3b82f6",
    teamId,
    isExpanded: true,
  };
}

export function TaskModal({
  isOpen,
  onClose,
  taskToEdit,
  defaultDate,
  defaultStartTime,
  teams = [],
  onTaskSaved,
}: TaskModalProps) {
  const isEditing = !!taskToEdit;

  // Single task editing states
  const [editTitle, setEditTitle] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editStartTime, setEditStartTime] = useState("");
  const [editEndTime, setEditEndTime] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editStatus, setEditStatus] = useState<TaskStatus>(TaskStatus.TODO);
  const [editPriority, setEditPriority] = useState<TaskPriority>(TaskPriority.MEDIUM);
  const [editLocation, setEditLocation] = useState("");
  const [editColor, setEditColor] = useState("#3b82f6");
  const [editTeamId, setEditTeamId] = useState<string>("");

  // Multiple task creation drafts
  const [tasks, setTasks] = useState<TaskDraft[]>([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (taskToEdit) {
      setEditTitle(taskToEdit.title || "");
      setEditDate(taskToEdit.dateString || toDateString(taskToEdit.date));
      setEditStartTime(taskToEdit.startTime || "");
      setEditEndTime(taskToEdit.endTime || "");
      setEditDescription(taskToEdit.description || "");
      setEditStatus(taskToEdit.status || TaskStatus.TODO);
      setEditPriority(taskToEdit.priority || TaskPriority.MEDIUM);
      setEditLocation(taskToEdit.location || "");
      setEditColor(taskToEdit.color || "#3b82f6");
      setEditTeamId(taskToEdit.teamId || "");
    } else {
      setTasks([createEmptyDraft(defaultDate, defaultStartTime)]);
    }
    setError(null);
  }, [taskToEdit, defaultDate, defaultStartTime, isOpen]);

  if (!isOpen) return null;

  // Add another task to the batch
  const handleAddTask = () => {
    const lastTask = tasks[tasks.length - 1];
    // By default inherit the date from the previous task, or defaultDate
    const newDraft = createEmptyDraft(
      lastTask ? lastTask.date : defaultDate,
      "",
      lastTask ? lastTask.teamId : ""
    );
    setTasks((prev) => [...prev, newDraft]);
  };

  // Duplicate an existing task
  const handleDuplicateTask = (index: number) => {
    const source = tasks[index];
    if (!source) return;
    const duplicated: TaskDraft = {
      ...source,
      id: Math.random().toString(36).substring(2, 9),
      title: source.title ? `${source.title} (Copy)` : "",
      isExpanded: true,
    };
    const next = [...tasks];
    next.splice(index + 1, 0, duplicated);
    setTasks(next);
  };

  // Remove a task from the batch
  const handleRemoveTask = (id: string) => {
    if (tasks.length <= 1) return;
    setTasks((prev) => prev.filter((t) => t.id !== id));
  };

  // Update a field on a specific task
  const handleUpdateTaskField = <K extends keyof TaskDraft>(
    id: string,
    field: K,
    value: TaskDraft[K]
  ) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, [field]: value } : t))
    );
  };

  // Toggle collapse/expand for a task card
  const handleToggleExpand = (id: string) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, isExpanded: !t.isExpanded } : t))
    );
  };

  // Expand or collapse all tasks
  const handleSetAllExpanded = (expanded: boolean) => {
    setTasks((prev) => prev.map((t) => ({ ...t, isExpanded: expanded })));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Edit Mode submission
    if (isEditing) {
      const hasStart = !!editStartTime && editStartTime.trim() !== "";
      const hasEnd = !!editEndTime && editEndTime.trim() !== "";

      if (hasEnd && !hasStart) {
        setError("Start time is required when end time is specified.");
        return;
      }

      if (hasStart && hasEnd && editEndTime <= editStartTime) {
        setError("End time must be strictly after start time.");
        return;
      }

      setLoading(true);
      try {
        const payload = {
          title: editTitle,
          date: editDate,
          startTime: hasStart ? editStartTime : null,
          endTime: hasEnd ? editEndTime : null,
          description: editDescription || null,
          status: editStatus,
          priority: editPriority,
          location: editLocation || null,
          color: editColor,
          teamId: editTeamId || null,
        };

        const result = await updateTask(taskToEdit.id, payload);
        if (!result.success) {
          setError(result.error || "An error occurred");
          setLoading(false);
          return;
        }

        onTaskSaved?.();
        onClose();
      } catch {
        setError("Failed to save task. Please try again.");
      } finally {
        setLoading(false);
      }
      return;
    }

    // Create Mode (Batch or Single)
    if (tasks.length === 0) {
      setError("Please add at least one task.");
      return;
    }

    // Validate each task in the batch
    for (let i = 0; i < tasks.length; i++) {
      const t = tasks[i];
      const taskNum = i + 1;

      if (!t.title.trim()) {
        setError(`Task #${taskNum}: Title is required.`);
        // Auto-expand failing task
        handleUpdateTaskField(t.id, "isExpanded", true);
        return;
      }

      if (!t.date.trim()) {
        setError(`Task #${taskNum}: Date is required.`);
        handleUpdateTaskField(t.id, "isExpanded", true);
        return;
      }

      const hasStart = !!t.startTime && t.startTime.trim() !== "";
      const hasEnd = !!t.endTime && t.endTime.trim() !== "";

      if (hasEnd && !hasStart) {
        setError(`Task #${taskNum}: Start time is required when end time is specified.`);
        handleUpdateTaskField(t.id, "isExpanded", true);
        return;
      }

      if (hasStart && hasEnd && t.endTime <= t.startTime) {
        setError(`Task #${taskNum}: End time must be strictly after start time.`);
        handleUpdateTaskField(t.id, "isExpanded", true);
        return;
      }
    }

    setLoading(true);

    try {
      const payloads = tasks.map((t) => ({
        title: t.title.trim(),
        date: t.date,
        startTime: t.startTime && t.startTime.trim() !== "" ? t.startTime : null,
        endTime: t.endTime && t.endTime.trim() !== "" ? t.endTime : null,
        description: t.description.trim() || null,
        status: t.status,
        priority: t.priority,
        location: t.location.trim() || null,
        color: t.color,
        teamId: t.teamId || null,
      }));

      const result = await createBatchTasks(payloads);

      if (!result.success) {
        setError(result.error || "An error occurred while creating tasks");
        setLoading(false);
        return;
      }

      onTaskSaved?.();
      onClose();
    } catch {
      setError("Failed to schedule tasks. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!taskToEdit) return;
    const confirmed = window.confirm("Are you sure you want to delete this task?");
    if (!confirmed) return;

    setLoading(true);
    const result = await deleteTask(taskToEdit.id);
    if (!result.success) {
      setError(result.error || "Failed to delete task");
      setLoading(false);
      return;
    }

    onTaskSaved?.();
    onClose();
  };

  // Helper count for batch tasks
  const personalTasksCount = tasks.filter((t) => !t.teamId).length;
  const teamTasksCount = tasks.filter((t) => !!t.teamId).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/50 backdrop-blur-sm animate-in fade-in">
      <div className="relative w-full max-w-2xl max-h-[92vh] flex flex-col rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 dark:border-zinc-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400">
              <Layers className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                {isEditing
                  ? "Edit Task"
                  : tasks.length > 1
                  ? `Schedule Tasks (${tasks.length})`
                  : "New Task"}
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                {isEditing
                  ? "Update task details and timing"
                  : tasks.length > 1
                  ? `Scheduling ${tasks.length} tasks (${personalTasksCount} personal, ${teamTasksCount} team)`
                  : "Schedule a task for yourself or your team"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4">
          {error && (
            <div className="flex items-center gap-2 rounded-lg bg-red-50 dark:bg-red-950/40 p-3 text-xs sm:text-sm text-red-700 dark:text-red-300 border border-red-200 dark:border-red-900">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* EDIT MODE: Single Task Form */}
          {isEditing ? (
            <div className="space-y-4">
              {/* Title */}
              <div>
                <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider mb-1">
                  Title *
                </label>
                <input
                  type="text"
                  required
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  placeholder="e.g. Weekly Roadmap Sync"
                  className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              {/* Date & Times */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                    <Calendar className="h-3 w-3" /> Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={editDate}
                    onChange={(e) => setEditDate(e.target.value)}
                    className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                    <Clock className="h-3 w-3" /> Start Time
                  </label>
                  <input
                    type="time"
                    value={editStartTime}
                    onChange={(e) => setEditStartTime(e.target.value)}
                    className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                    <Clock className="h-3 w-3" /> End Time
                  </label>
                  <input
                    type="time"
                    value={editEndTime}
                    onChange={(e) => setEditEndTime(e.target.value)}
                    className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>
              <p className="text-[11px] text-zinc-500">
                Leave times empty for all-day task. End time requires a start time.
              </p>

              {/* Status & Priority */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider mb-1">
                    Status
                  </label>
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value as TaskStatus)}
                    className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value={TaskStatus.TODO}>To Do</option>
                    <option value={TaskStatus.IN_PROGRESS}>In Progress</option>
                    <option value={TaskStatus.DONE}>Done</option>
                    <option value={TaskStatus.CANCELLED}>Cancelled</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider mb-1">
                    Priority
                  </label>
                  <select
                    value={editPriority}
                    onChange={(e) => setEditPriority(e.target.value as TaskPriority)}
                    className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value={TaskPriority.LOW}>Low</option>
                    <option value={TaskPriority.MEDIUM}>Medium</option>
                    <option value={TaskPriority.HIGH}>High</option>
                  </select>
                </div>
              </div>

              {/* Location */}
              <div>
                <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                  <MapPin className="h-3 w-3" /> Location
                </label>
                <input
                  type="text"
                  value={editLocation}
                  onChange={(e) => setEditLocation(e.target.value)}
                  placeholder="e.g. Room 402 or Zoom link"
                  className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              {/* Color Label */}
              <div>
                <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                  <Tag className="h-3 w-3" /> Color Label
                </label>
                <div className="flex items-center gap-2">
                  {COLOR_OPTIONS.map((c) => (
                    <button
                      key={c.value}
                      type="button"
                      onClick={() => setEditColor(c.value)}
                      style={{ backgroundColor: c.value }}
                      className={`h-7 w-7 rounded-full transition-transform ${
                        editColor === c.value
                          ? "ring-2 ring-offset-2 ring-zinc-800 dark:ring-zinc-200 scale-110"
                          : "opacity-80 hover:opacity-100"
                      }`}
                      title={c.label}
                    />
                  ))}
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                  <AlignLeft className="h-3 w-3" /> Description
                </label>
                <textarea
                  rows={3}
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  placeholder="Add details, links, or notes..."
                  className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>
          ) : (
            /* CREATE MODE: Batch Task Creation */
            <div className="space-y-4">
              {/* Batch Actions Bar (when > 1 task) */}
              {tasks.length > 1 && (
                <div className="flex items-center justify-between pb-1 text-xs text-zinc-500">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-zinc-700 dark:text-zinc-300">
                      {tasks.length} Tasks in batch
                    </span>
                    <span>•</span>
                    <span>{personalTasksCount} Personal</span>
                    <span>•</span>
                    <span>{teamTasksCount} Team</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleSetAllExpanded(true)}
                      className="hover:text-blue-600 dark:hover:text-blue-400 transition"
                    >
                      Expand All
                    </button>
                    <span>|</span>
                    <button
                      type="button"
                      onClick={() => handleSetAllExpanded(false)}
                      className="hover:text-blue-600 dark:hover:text-blue-400 transition"
                    >
                      Collapse All
                    </button>
                  </div>
                </div>
              )}

              {/* Task Cards List */}
              <div className="space-y-3">
                {tasks.map((task, index) => {
                  const teamName = task.teamId
                    ? teams.find((t) => t.id === task.teamId)?.name || "Team Task"
                    : "Personal Task";

                  return (
                    <div
                      key={task.id}
                      className="border border-zinc-200 dark:border-zinc-800 rounded-xl bg-zinc-50/50 dark:bg-zinc-800/20 overflow-hidden transition-all shadow-xs"
                    >
                      {/* Task Card Header */}
                      <div
                        onClick={() => handleToggleExpand(task.id)}
                        className="flex items-center justify-between px-4 py-3 bg-white dark:bg-zinc-800/60 cursor-pointer select-none hover:bg-zinc-50 dark:hover:bg-zinc-800 transition border-b border-zinc-100 dark:border-zinc-800"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 text-xs font-bold">
                            {index + 1}
                          </span>
                          <span
                            className="h-3 w-3 rounded-full shrink-0"
                            style={{ backgroundColor: task.color }}
                          />
                          <span className="font-semibold text-sm text-zinc-900 dark:text-zinc-100 truncate max-w-[160px] sm:max-w-[240px]">
                            {task.title || `Task #${index + 1}`}
                          </span>
                          <span className="hidden sm:inline-flex items-center gap-1 font-mono text-[11px] text-zinc-500 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded">
                            <Calendar className="h-3 w-3" />
                            {task.date || "No date"}
                          </span>
                          <span
                            className={`hidden md:inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded ${
                              task.teamId
                                ? "bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300"
                                : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400"
                            }`}
                          >
                            {task.teamId ? <Users className="h-3 w-3" /> : null}
                            {teamName}
                          </span>
                        </div>

                        {/* Card Top Actions */}
                        <div
                          className="flex items-center gap-1 shrink-0"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            onClick={() => handleDuplicateTask(index)}
                            title="Duplicate this task"
                            className="p-1 rounded-md text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700/60 transition"
                          >
                            <Copy className="h-4 w-4" />
                          </button>
                          {tasks.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveTask(task.id)}
                              title="Delete this task card"
                              className="p-1 rounded-md text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 transition"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleToggleExpand(task.id)}
                            title={task.isExpanded ? "Collapse" : "Expand"}
                            className="p-1 rounded-md text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700/60 transition"
                          >
                            {task.isExpanded ? (
                              <ChevronUp className="h-4 w-4" />
                            ) : (
                              <ChevronDown className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                      </div>

                      {/* Task Card Body (Expanded) */}
                      {task.isExpanded && (
                        <div className="p-4 space-y-3.5">
                          {/* Title */}
                          <div>
                            <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider mb-1">
                              Title *
                            </label>
                            <input
                              type="text"
                              required
                              value={task.title}
                              onChange={(e) =>
                                handleUpdateTaskField(task.id, "title", e.target.value)
                              }
                              placeholder="e.g. Weekly Roadmap Sync"
                              className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                          </div>

                          {/* Date & Times */}
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <div>
                              <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                                <Calendar className="h-3 w-3" /> Date *
                              </label>
                              <input
                                type="date"
                                required
                                value={task.date}
                                onChange={(e) =>
                                  handleUpdateTaskField(task.id, "date", e.target.value)
                                }
                                className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-1.5 text-sm text-zinc-900 dark:text-zinc-100 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                                <Clock className="h-3 w-3" /> Start Time
                              </label>
                              <input
                                type="time"
                                value={task.startTime}
                                onChange={(e) =>
                                  handleUpdateTaskField(task.id, "startTime", e.target.value)
                                }
                                className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-1.5 text-sm text-zinc-900 dark:text-zinc-100 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                                <Clock className="h-3 w-3" /> End Time
                              </label>
                              <input
                                type="time"
                                value={task.endTime}
                                onChange={(e) =>
                                  handleUpdateTaskField(task.id, "endTime", e.target.value)
                                }
                                className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-1.5 text-sm text-zinc-900 dark:text-zinc-100 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                              />
                            </div>
                          </div>

                          {/* Status & Priority */}
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider mb-1">
                                Status
                              </label>
                              <select
                                value={task.status}
                                onChange={(e) =>
                                  handleUpdateTaskField(
                                    task.id,
                                    "status",
                                    e.target.value as TaskStatus
                                  )
                                }
                                className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-1.5 text-sm text-zinc-900 dark:text-zinc-100 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                              >
                                <option value={TaskStatus.TODO}>To Do</option>
                                <option value={TaskStatus.IN_PROGRESS}>In Progress</option>
                                <option value={TaskStatus.DONE}>Done</option>
                                <option value={TaskStatus.CANCELLED}>Cancelled</option>
                              </select>
                            </div>
                            <div>
                              <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider mb-1">
                                Priority
                              </label>
                              <select
                                value={task.priority}
                                onChange={(e) =>
                                  handleUpdateTaskField(
                                    task.id,
                                    "priority",
                                    e.target.value as TaskPriority
                                  )
                                }
                                className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-1.5 text-sm text-zinc-900 dark:text-zinc-100 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                              >
                                <option value={TaskPriority.LOW}>Low</option>
                                <option value={TaskPriority.MEDIUM}>Medium</option>
                                <option value={TaskPriority.HIGH}>High</option>
                              </select>
                            </div>
                          </div>

                          {/* Location & Team assignment */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                              <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                                <MapPin className="h-3 w-3" /> Location
                              </label>
                              <input
                                type="text"
                                value={task.location}
                                onChange={(e) =>
                                  handleUpdateTaskField(task.id, "location", e.target.value)
                                }
                                placeholder="e.g. Room 402 or Zoom link"
                                className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-1.5 text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                              />
                            </div>
                            {teams.length > 0 && (
                              <div>
                                <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider mb-1">
                                  Team Assignment
                                </label>
                                <select
                                  value={task.teamId}
                                  onChange={(e) =>
                                    handleUpdateTaskField(task.id, "teamId", e.target.value)
                                  }
                                  className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-1.5 text-sm text-zinc-900 dark:text-zinc-100 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                >
                                  <option value="">Personal Task (No Team)</option>
                                  {teams.map((t) => (
                                    <option key={t.id} value={t.id}>
                                      {t.name}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            )}
                          </div>

                          {/* Color Label & Description */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-start">
                            <div>
                              <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                                <Tag className="h-3 w-3" /> Color Label
                              </label>
                              <div className="flex items-center gap-2 pt-1">
                                {COLOR_OPTIONS.map((c) => (
                                  <button
                                    key={c.value}
                                    type="button"
                                    onClick={() =>
                                      handleUpdateTaskField(task.id, "color", c.value)
                                    }
                                    style={{ backgroundColor: c.value }}
                                    className={`h-6 w-6 rounded-full transition-transform ${
                                      task.color === c.value
                                        ? "ring-2 ring-offset-2 ring-zinc-800 dark:ring-zinc-200 scale-110"
                                        : "opacity-80 hover:opacity-100"
                                    }`}
                                    title={c.label}
                                  />
                                ))}
                              </div>
                            </div>
                          </div>

                          {/* Description */}
                          <div>
                            <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                              <AlignLeft className="h-3 w-3" /> Description
                            </label>
                            <textarea
                              rows={2}
                              value={task.description}
                              onChange={(e) =>
                                handleUpdateTaskField(task.id, "description", e.target.value)
                              }
                              placeholder="Add details, links, or notes..."
                              className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-1.5 text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Add Task Button */}
              <button
                type="button"
                onClick={handleAddTask}
                className="w-full flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-zinc-200 dark:border-zinc-800 py-2.5 text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:text-blue-600 dark:hover:text-blue-400 hover:border-blue-300 dark:hover:border-blue-800 hover:bg-blue-50/50 dark:hover:bg-blue-950/20 transition"
              >
                <Plus className="h-4 w-4" />
                <span>Add Another Task to Schedule</span>
              </button>
            </div>
          )}

          {/* Action buttons footer */}
          <div className="flex items-center justify-between pt-3 border-t border-zinc-100 dark:border-zinc-800">
            {isEditing ? (
              <button
                type="button"
                onClick={handleDelete}
                disabled={loading}
                className="flex items-center gap-1.5 text-xs font-medium text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/40 px-3 py-2 rounded-lg transition"
              >
                <Trash2 className="h-4 w-4" />
                <span>Delete</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleAddTask}
                className="hidden sm:flex items-center gap-1 text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>+ Add task</span>
              </button>
            )}

            <div className="flex items-center gap-2 ml-auto">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-zinc-300 dark:border-zinc-700 px-4 py-2 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="rounded-lg bg-blue-600 px-5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-blue-700 disabled:opacity-50 transition"
              >
                {loading
                  ? "Saving..."
                  : isEditing
                  ? "Save Changes"
                  : tasks.length > 1
                  ? `Create ${tasks.length} Tasks`
                  : "Create Task"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
