"use client";

import { useState } from "react";
import { TaskStatus, TaskPriority } from "@prisma/client";
import { formatTaskTiming } from "@/lib/date-utils";
import { format, parseISO } from "date-fns";
import { TaskModal } from "./task-modal";
import { ProposeTaskModal } from "./propose-task-modal";
import { toggleTaskComplete, getCalendarTasks, deleteTask } from "@/actions/task-actions";
import {
  Check,
  Plus,
  Search,
  Calendar,
  Clock,
  MapPin,
  Users,
  Flag,
  Trash2,
  Edit2,
  Filter,
  Send,
} from "lucide-react";

interface TeamOption {
  id: string;
  name: string;
  role: string;
}

interface TasksListProps {
  initialTasks: any[];
  teams: TeamOption[];
  currentUserId?: string;
}

export function TasksList({ initialTasks, teams, currentUserId }: TasksListProps) {
  const [tasks, setTasks] = useState<any[]>(initialTasks);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [priorityFilter, setPriorityFilter] = useState<string>("ALL");
  const [teamFilter, setTeamFilter] = useState<string>("ALL");

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<any | null>(null);

  // Propose Modal State
  const [proposeModalOpen, setProposeModalOpen] = useState(false);
  const [proposeInitialData, setProposeInitialData] = useState<{
    title?: string;
    date?: string;
    startTime?: string;
    endTime?: string;
    teamId?: string;
    description?: string;
  } | undefined>(undefined);

  const refreshTasks = async () => {
    const updated = await getCalendarTasks(teamFilter === "ALL" ? "all" : teamFilter);
    setTasks(updated);
  };

  const handleToggle = async (taskId: string) => {
    setTasks((prev) =>
      prev.map((t) =>
        t.id === taskId
          ? { ...t, status: t.status === "DONE" ? "TODO" : "DONE" }
          : t
      )
    );
    const res = await toggleTaskComplete(taskId);
    if (!res.success) {
      await refreshTasks();
    }
  };

  const handleDelete = async (taskId: string) => {
    const confirmed = window.confirm("Are you sure you want to delete this task?");
    if (!confirmed) return;

    setTasks((prev) => prev.filter((t) => t.id !== taskId));
    const res = await deleteTask(taskId);
    if (!res.success) {
      alert(res.error || "Failed to delete task");
      await refreshTasks();
    }
  };

  // Filter tasks
  const filteredTasks = tasks.filter((t) => {
    if (statusFilter !== "ALL" && t.status !== statusFilter) return false;
    if (priorityFilter !== "ALL" && t.priority !== priorityFilter) return false;
    if (teamFilter === "PERSONAL" && t.teamId !== null) return false;
    if (teamFilter !== "ALL" && teamFilter !== "PERSONAL" && t.teamId !== teamFilter) return false;

    if (search) {
      const q = search.toLowerCase();
      const matchTitle = t.title.toLowerCase().includes(q);
      const matchDesc = t.description && t.description.toLowerCase().includes(q);
      const matchLoc = t.location && t.location.toLowerCase().includes(q);
      return matchTitle || matchDesc || matchLoc;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Page Title & Add Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            Task Management
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Create, view, organize, and complete your personal and team tasks.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {currentUserId && (
            <button
              onClick={() => {
                setProposeInitialData(undefined);
                setProposeModalOpen(true);
              }}
              className="flex items-center gap-1.5 rounded-lg border border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-950/40 px-3.5 py-2 text-sm font-semibold text-purple-700 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-900/60 transition shadow-xs"
              title="Propose a task to a teammate"
            >
              <Send className="h-4 w-4" />
              <span>Propose Task</span>
            </button>
          )}

          <button
            onClick={() => {
              setSelectedTask(null);
              setModalOpen(true);
            }}
            className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 transition"
          >
            <Plus className="h-4 w-4" />
            <span>New Task</span>
          </button>
        </div>
      </div>

      {/* Filter Controls Bar */}
      <div className="flex flex-wrap items-center gap-3 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm">
        {/* Search Input */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tasks..."
            className="w-full rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800 py-1.5 pl-9 pr-3 text-xs text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        {/* Status Filter */}
        <div className="flex items-center gap-1.5 text-xs text-zinc-600 dark:text-zinc-400">
          <span className="font-medium">Status:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800 px-2 py-1.5 text-xs focus:outline-none"
          >
            <option value="ALL">All Statuses</option>
            <option value={TaskStatus.TODO}>To Do</option>
            <option value={TaskStatus.IN_PROGRESS}>In Progress</option>
            <option value={TaskStatus.DONE}>Done</option>
            <option value={TaskStatus.CANCELLED}>Cancelled</option>
          </select>
        </div>

        {/* Priority Filter */}
        <div className="flex items-center gap-1.5 text-xs text-zinc-600 dark:text-zinc-400">
          <span className="font-medium">Priority:</span>
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800 px-2 py-1.5 text-xs focus:outline-none"
          >
            <option value="ALL">All Priorities</option>
            <option value={TaskPriority.LOW}>Low</option>
            <option value={TaskPriority.MEDIUM}>Medium</option>
            <option value={TaskPriority.HIGH}>High</option>
          </select>
        </div>

        {/* Team Scope Filter */}
        <div className="flex items-center gap-1.5 text-xs text-zinc-600 dark:text-zinc-400">
          <span className="font-medium">Scope:</span>
          <select
            value={teamFilter}
            onChange={(e) => setTeamFilter(e.target.value)}
            className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800 px-2 py-1.5 text-xs focus:outline-none"
          >
            <option value="ALL">All Tasks</option>
            <option value="PERSONAL">Personal Only</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Tasks Table / List */}
      {filteredTasks.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-300 dark:border-zinc-800 p-12 text-center bg-white dark:bg-zinc-900 space-y-3">
          <p className="text-zinc-500 text-sm">No tasks match your criteria.</p>
          <button
            onClick={() => {
              setSelectedTask(null);
              setModalOpen(true);
            }}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-blue-700 transition"
          >
            Create New Task
          </button>
        </div>
      ) : (
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden shadow-sm divide-y divide-zinc-200 dark:divide-zinc-800">
          {filteredTasks.map((task) => {
            const isDone = task.status === "DONE";
            const dateStr = task.dateString || task.date;

            return (
              <div
                key={task.id}
                className={`flex flex-col sm:flex-row sm:items-center justify-between p-4 gap-4 hover:bg-zinc-50/60 dark:hover:bg-zinc-800/30 transition ${
                  isDone ? "opacity-60 bg-zinc-50/20" : ""
                }`}
              >
                {/* Left: Checkbox + Title + Metadata */}
                <div className="flex items-start gap-3">
                  <button
                    type="button"
                    onClick={() => handleToggle(task.id)}
                    className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border transition ${
                      isDone
                        ? "bg-emerald-600 border-emerald-600 text-white"
                        : "border-zinc-400 hover:border-zinc-600"
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
                      <span
                        className={`text-sm font-semibold text-zinc-900 dark:text-zinc-100 ${
                          isDone ? "line-through text-zinc-500" : ""
                        }`}
                      >
                        {task.title}
                      </span>
                    </div>

                    {task.description && (
                      <p className="text-xs text-zinc-500 line-clamp-1">
                        {task.description}
                      </p>
                    )}

                    <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-500 pt-0.5">
                      <span className="flex items-center gap-1 font-mono">
                        <Calendar className="h-3 w-3 text-zinc-400" />
                        <span>{format(parseISO(dateStr), "MMM d, yyyy")}</span>
                      </span>

                      <span className="flex items-center gap-1 font-mono">
                        <Clock className="h-3 w-3 text-zinc-400" />
                        <span>{formatTaskTiming(task.startTime, task.endTime)}</span>
                      </span>

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

                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                          task.priority === "HIGH"
                            ? "bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-300"
                            : task.priority === "MEDIUM"
                            ? "bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300"
                            : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400"
                        }`}
                      >
                        {task.priority}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Right: Actions */}
                <div className="flex items-center gap-2 self-end sm:self-center">
                  <button
                    onClick={() => {
                      setSelectedTask(task);
                      setModalOpen(true);
                    }}
                    className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
                    title="Edit Task"
                  >
                    <Edit2 className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(task.id)}
                    className="p-1.5 rounded-lg text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/40 transition"
                    title="Delete Task"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Task Edit Modal */}
      <TaskModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        taskToEdit={selectedTask}
        teams={teams}
        onTaskSaved={refreshTasks}
        onOpenProposeTaskModal={
          currentUserId
            ? (data) => {
                setProposeInitialData(data);
                setProposeModalOpen(true);
              }
            : undefined
        }
      />

      {/* Propose Task Modal */}
      {proposeModalOpen && currentUserId && (
        <ProposeTaskModal
          isOpen={proposeModalOpen}
          onClose={() => setProposeModalOpen(false)}
          teams={teams.map((t) => ({ ...t, role: t.role as any }))}
          initialData={proposeInitialData}
          currentUserId={currentUserId}
          onSuccess={() => refreshTasks()}
        />
      )}
    </div>
  );
}
