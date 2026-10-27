"use client";

import { useState } from "react";
import { TaskStatus, TaskPriority } from "@prisma/client";
import { formatTaskTiming } from "@/lib/date-utils";
import { format, parseISO } from "date-fns";
import { TaskModal } from "./task-modal";
import { ProposeTaskModal } from "./propose-task-modal";
import { ConvertTaskModal } from "./convert-task-modal";
import { PenaltyDashboardWidget } from "./penalty-dashboard-widget";
import { AssigneeBadge } from "./assignee-badge";
import {
  toggleTaskComplete,
  getCalendarTasks,
  deleteTask,
  removePenaltyAction,
} from "@/actions/task-actions";
import {
  Check,
  Plus,
  Search,
  Calendar,
  Clock,
  MapPin,
  Users,
  User,
  Trash2,
  Edit2,
  Send,
  ArrowUpRight,
  AlertTriangle,
  Layers,
  Filter,
} from "lucide-react";

interface TeamOption {
  id: string;
  name: string;
  role: string;
  members?: any[];
}

interface TasksListProps {
  initialTasks: any[];
  teams: TeamOption[];
  currentUserId?: string;
  initialSection?: "ALL" | "PERSONAL" | "TEAM";
  initialTeamId?: string;
  initialAssignment?: "ALL" | "ME" | "OTHERS";
}

export function TasksList({
  initialTasks,
  teams,
  currentUserId,
  initialSection = "ALL",
  initialTeamId,
  initialAssignment = "ALL",
}: TasksListProps) {
  const [tasks, setTasks] = useState<any[]>(initialTasks);
  const [search, setSearch] = useState("");
  const [section, setSection] = useState<"ALL" | "PERSONAL" | "TEAM">(initialSection);
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [priorityFilter, setPriorityFilter] = useState<string>("ALL");
  const [teamFilter, setTeamFilter] = useState<string>(initialTeamId || "ALL");
  const [assignmentFilter, setAssignmentFilter] = useState<"ALL" | "ME" | "OTHERS">(initialAssignment);

  // Edit / Create Task Modal State
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

  // Convert Personal Task Modal State
  const [convertModalOpen, setConvertModalOpen] = useState(false);
  const [taskToConvert, setTaskToConvert] = useState<any | null>(null);

  // Key to force refresh Penalty widget
  const [penaltyWidgetKey, setPenaltyWidgetKey] = useState(0);
  const [removingPenaltyId, setRemovingPenaltyId] = useState<string | null>(null);

  const handleRemovePenalty = async (penaltyId: string, taskTitle: string) => {
    if (!window.confirm(`Are you sure you want to remove the penalty for "${taskTitle}"?`)) {
      return;
    }

    setRemovingPenaltyId(penaltyId);
    try {
      const res = await removePenaltyAction(penaltyId);
      if (!res.success) {
        alert(res.error || "Failed to remove penalty");
      } else {
        await refreshTasks();
      }
    } catch {
      alert("Failed to remove penalty. Please try again.");
    } finally {
      setRemovingPenaltyId(null);
    }
  };

  const refreshTasks = async () => {
    let filterParam = "all";
    if (section === "PERSONAL") {
      filterParam = "personal";
    } else if (section === "TEAM") {
      if (teamFilter !== "ALL") {
        filterParam =
          assignmentFilter === "ME"
            ? `${teamFilter}:me`
            : assignmentFilter === "OTHERS"
            ? `${teamFilter}:others`
            : teamFilter;
      } else {
        filterParam =
          assignmentFilter === "ME"
            ? "team-assigned-to-me"
            : assignmentFilter === "OTHERS"
            ? "team-assigned-to-others"
            : "team";
      }
    } else {
      if (teamFilter !== "ALL") {
        filterParam =
          assignmentFilter === "ME"
            ? `${teamFilter}:me`
            : assignmentFilter === "OTHERS"
            ? `${teamFilter}:others`
            : teamFilter;
      } else {
        filterParam =
          assignmentFilter === "ME"
            ? "all-assigned-to-me"
            : assignmentFilter === "OTHERS"
            ? "team-assigned-to-others"
            : "all";
      }
    }

    const updated = await getCalendarTasks(filterParam);
    setTasks(updated);
    setPenaltyWidgetKey((prev) => prev + 1);
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
    } else {
      setPenaltyWidgetKey((prev) => prev + 1);
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
    } else {
      setPenaltyWidgetKey((prev) => prev + 1);
    }
  };

  const handleTaskConverted = (updatedTask: any) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === updatedTask.id ? { ...t, ...updatedTask } : t))
    );
    setPenaltyWidgetKey((prev) => prev + 1);
  };

  // Section Counts
  const personalTasksCount = tasks.filter((t) => t.teamId === null).length;
  const teamTasksCount = tasks.filter((t) => t.teamId !== null).length;

  // Filter tasks based on Section, Status, Priority, Team, and Search
  const filteredTasks = tasks.filter((t) => {
    // 1. Strict Section Filtering
    // Personal section: ONLY tasks with NO team (teamId === null)
    if (section === "PERSONAL" && t.teamId !== null) return false;
    // Team section: ONLY tasks WITH team (teamId !== null). Personal tasks NEVER appear.
    if (section === "TEAM" && t.teamId === null) return false;

    // 2. Additional Team selector (when in Team section or All Tasks)
    if (section === "TEAM" && teamFilter !== "ALL" && t.teamId !== teamFilter) {
      return false;
    }
    if (section === "ALL" && teamFilter !== "ALL" && t.teamId !== teamFilter) {
      return false;
    }

    // 3. Status Filter
    if (statusFilter !== "ALL" && t.status !== statusFilter) return false;

    // 4. Priority Filter
    if (priorityFilter !== "ALL" && t.priority !== priorityFilter) return false;

    // 5. Assignment Filter
    if (section !== "PERSONAL" && assignmentFilter !== "ALL") {
      const isAssignedToMe =
        t.teamId === null ||
        (Array.isArray(t.assignees) && t.assignees.some((a: any) => a.id === currentUserId)) ||
        t.assigneeId === currentUserId;

      if (assignmentFilter === "ME" && !isAssignedToMe) {
        return false;
      }
      if (assignmentFilter === "OTHERS" && isAssignedToMe) {
        return false;
      }
    }

    // 6. Search Query
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

      {/* Monthly Penalty System Widget */}
      <PenaltyDashboardWidget
        key={penaltyWidgetKey}
        currentUserId={currentUserId}
        onSettingsChanged={refreshTasks}
        activeSection={section}
      />

      {/* Primary Section Tabs: All Tasks | Personal Tasks | Team Tasks */}
      <div className="flex items-center border-b border-zinc-200 dark:border-zinc-800 space-x-1 sm:space-x-3">
        <button
          onClick={() => {
            setSection("ALL");
            setTeamFilter("ALL");
          }}
          className={`flex items-center gap-2 py-3 px-3.5 text-xs sm:text-sm font-semibold border-b-2 transition ${
            section === "ALL"
              ? "border-blue-600 text-blue-600 dark:text-blue-400"
              : "border-transparent text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:border-zinc-300"
          }`}
        >
          <Layers className="h-4 w-4" />
          <span>All Tasks</span>
          <span className="ml-1 rounded-full px-2 py-0.5 text-[11px] font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300">
            {tasks.length}
          </span>
        </button>

        <button
          onClick={() => {
            setSection("PERSONAL");
            setTeamFilter("ALL");
          }}
          className={`flex items-center gap-2 py-3 px-3.5 text-xs sm:text-sm font-semibold border-b-2 transition ${
            section === "PERSONAL"
              ? "border-blue-600 text-blue-600 dark:text-blue-400"
              : "border-transparent text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:border-zinc-300"
          }`}
        >
          <User className="h-4 w-4" />
          <span>Personal Tasks</span>
          <span className="ml-1 rounded-full px-2 py-0.5 text-[11px] font-bold bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300">
            {personalTasksCount}
          </span>
        </button>

        <button
          onClick={() => setSection("TEAM")}
          className={`flex items-center gap-2 py-3 px-3.5 text-xs sm:text-sm font-semibold border-b-2 transition ${
            section === "TEAM"
              ? "border-purple-600 text-purple-600 dark:text-purple-400"
              : "border-transparent text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:border-zinc-300"
          }`}
        >
          <Users className="h-4 w-4" />
          <span>Team Tasks</span>
          <span className="ml-1 rounded-full px-2 py-0.5 text-[11px] font-bold bg-purple-50 dark:bg-purple-950 text-purple-700 dark:text-purple-300">
            {teamTasksCount}
          </span>
        </button>
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
            placeholder={`Search ${
              section === "PERSONAL"
                ? "personal tasks..."
                : section === "TEAM"
                ? "team tasks..."
                : "all tasks..."
            }`}
            className="w-full rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800 py-1.5 pl-9 pr-3 text-xs text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        {/* Team Selector (Only available when in Team Tasks section or All Tasks) */}
        {section !== "PERSONAL" && teams.length > 0 && (
          <div className="flex items-center gap-1.5 text-xs text-zinc-600 dark:text-zinc-400">
            <span className="font-medium">Team:</span>
            <select
              value={teamFilter}
              onChange={(e) => setTeamFilter(e.target.value)}
              className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800 px-2 py-1.5 text-xs focus:outline-none"
            >
              <option value="ALL">All Teams</option>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Assignment Filter (Only available when in Team Tasks section or All Tasks) */}
        {section !== "PERSONAL" && (
          <div className="flex items-center gap-1.5 text-xs text-zinc-600 dark:text-zinc-400">
            <span className="font-medium">Assignment:</span>
            <select
              value={assignmentFilter}
              onChange={(e) => setAssignmentFilter(e.target.value as "ALL" | "ME" | "OTHERS")}
              className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800 px-2 py-1.5 text-xs focus:outline-none"
            >
              <option value="ALL">All Assignments</option>
              <option value="ME">Assigned to Me</option>
              <option value="OTHERS">Assigned to Others</option>
            </select>
          </div>
        )}

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
      </div>

      {/* Tasks Table / List */}
      {filteredTasks.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-300 dark:border-zinc-800 p-12 text-center bg-white dark:bg-zinc-900 space-y-3">
          <p className="text-zinc-500 text-sm">
            {section === "PERSONAL"
              ? "No personal tasks match your criteria."
              : section === "TEAM"
              ? "No team tasks match your criteria."
              : "No tasks match your criteria."}
          </p>
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
            const isPersonal = task.teamId === null;
            const hasPenalty = !!task.penalty;

            return (
              <div
                key={task.id}
                className={`flex flex-col sm:flex-row sm:items-center justify-between p-4 gap-4 hover:bg-zinc-50/60 dark:hover:bg-zinc-800/30 transition ${
                  isDone ? "opacity-60 bg-zinc-50/20" : ""
                }`}
              >
                {/* Left: Checkbox + Title + Badges + Metadata */}
                <div className="flex items-start gap-3 flex-1 min-w-0">
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

                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        style={{ backgroundColor: task.color || "#3b82f6" }}
                        className="h-2.5 w-2.5 rounded-full shrink-0"
                      />
                      <span
                        className={`text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate ${
                          isDone ? "line-through text-zinc-500" : ""
                        }`}
                      >
                        {task.title}
                      </span>

                      {/* Personal Task Badge (shown in All Tasks view) */}
                      {section === "ALL" && isPersonal && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300">
                          Personal
                        </span>
                      )}

                      {/* Team Task Badge */}
                      {task.team && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          <span>{task.team.name}</span>
                        </span>
                      )}

                      {/* Penalty Badge & Quick Remove */}
                      {hasPenalty && (
                        <div className="flex items-center gap-1.5">
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300 flex items-center gap-1">
                            <AlertTriangle className="h-3 w-3" />
                            <span>Penalty Recorded</span>
                          </span>

                          <button
                            type="button"
                            onClick={() => handleRemovePenalty(task.penalty.id, task.title)}
                            disabled={removingPenaltyId === task.penalty.id}
                            className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 border border-red-200 dark:border-red-900/50 transition disabled:opacity-50"
                            title="Remove this penalty"
                          >
                            <Trash2 className="h-2.5 w-2.5" />
                            <span>{removingPenaltyId === task.penalty.id ? "Removing..." : "Remove"}</span>
                          </button>
                        </div>
                      )}
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

                      <AssigneeBadge
                        assignees={task.assignees}
                        singleAssignee={task.assignee}
                      />

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
                <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                  {/* Convert to Team Task Action (Available for Personal Tasks) */}
                  {isPersonal && teams.length > 0 && (
                    <button
                      onClick={() => {
                        setTaskToConvert(task);
                        setConvertModalOpen(true);
                      }}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-indigo-200 dark:border-indigo-800 bg-indigo-50/70 dark:bg-indigo-950/40 text-xs font-semibold text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 transition shadow-2xs"
                      title="Convert this personal task into a team task"
                    >
                      <ArrowUpRight className="h-3.5 w-3.5" />
                      <span>Convert to Team Task</span>
                    </button>
                  )}

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

      {/* Task Edit / Create Modal */}
      <TaskModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        taskToEdit={selectedTask}
        teams={teams}
        currentUserId={currentUserId}
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

      {/* Convert Personal Task Modal */}
      {convertModalOpen && taskToConvert && (
        <ConvertTaskModal
          isOpen={convertModalOpen}
          onClose={() => {
            setConvertModalOpen(false);
            setTaskToConvert(null);
          }}
          task={taskToConvert}
          teams={teams}
          currentUserId={currentUserId}
          onSuccess={handleTaskConverted}
        />
      )}

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
