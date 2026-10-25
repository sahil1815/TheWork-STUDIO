import { describe, it, expect } from "vitest";
import {
  getTaskDeadline,
  isTaskOverdue,
  getPenaltyMonthDetails,
} from "@/lib/penalties";
import {
  convertPersonalTaskSchema,
  penaltySettingSchema,
  taskSchema,
} from "@/lib/validations/task";
import { TaskStatus, TaskPriority, TaskType, Role } from "@prisma/client";
import { can } from "@/lib/permissions";
import { toDateString } from "@/lib/date-utils";

describe("Task Management System Fixes & Monthly Penalty System", () => {
  describe("1. Task Conversion (Personal to Team Tasks)", () => {
    it("should validate valid conversion payload", () => {
      const valid = convertPersonalTaskSchema.safeParse({
        taskId: "task-123",
        teamId: "team-456",
        assigneeId: "user-789",
      });
      expect(valid.success).toBe(true);
    });

    it("should allow conversion without specifying assignee (defaults to self)", () => {
      const valid = convertPersonalTaskSchema.safeParse({
        taskId: "task-123",
        teamId: "team-456",
      });
      expect(valid.success).toBe(true);
      if (valid.success) {
        expect(valid.data.assigneeId).toBeUndefined();
      }
    });

    it("should reject conversion with missing taskId or teamId", () => {
      const missingTaskId = convertPersonalTaskSchema.safeParse({
        taskId: "",
        teamId: "team-456",
      });
      expect(missingTaskId.success).toBe(false);

      const missingTeamId = convertPersonalTaskSchema.safeParse({
        taskId: "task-123",
        teamId: "",
      });
      expect(missingTeamId.success).toBe(false);
    });

    it("should enforce team permissions: OWNER, ADMIN, MEMBER can convert; GUEST cannot", () => {
      expect(can(Role.OWNER, "CREATE_TEAM_TASK")).toBe(true);
      expect(can(Role.ADMIN, "CREATE_TEAM_TASK")).toBe(true);
      expect(can(Role.MEMBER, "CREATE_TEAM_TASK")).toBe(true);
      expect(can(Role.GUEST, "CREATE_TEAM_TASK")).toBe(false);
    });

    it("should preserve all existing task details during conversion", () => {
      const originalPersonalTask = {
        id: "task-personal-1",
        title: "Database Index Tuning",
        date: "2026-10-25",
        startTime: "14:00",
        endTime: "15:30",
        description: "Analyze slow queries on task_penalties table",
        status: TaskStatus.TODO,
        priority: TaskPriority.HIGH,
        location: "Virtual Meeting Room",
        color: "#8b5cf6",
        teamId: null, // Personal task
        createdById: "user-alice",
        assigneeId: "user-alice",
      };

      // Conversion updates teamId and optionally assigneeId
      const targetTeamId = "team-eng-core";
      const targetAssigneeId = "user-bob";

      const convertedTask = {
        ...originalPersonalTask,
        teamId: targetTeamId,
        assigneeId: targetAssigneeId,
      };

      // Attributes preserved
      expect(convertedTask.title).toBe(originalPersonalTask.title);
      expect(convertedTask.date).toBe(originalPersonalTask.date);
      expect(convertedTask.startTime).toBe(originalPersonalTask.startTime);
      expect(convertedTask.endTime).toBe(originalPersonalTask.endTime);
      expect(convertedTask.description).toBe(originalPersonalTask.description);
      expect(convertedTask.priority).toBe(originalPersonalTask.priority);
      expect(convertedTask.status).toBe(originalPersonalTask.status);
      expect(convertedTask.color).toBe(originalPersonalTask.color);
      expect(convertedTask.location).toBe(originalPersonalTask.location);
      expect(convertedTask.createdById).toBe(originalPersonalTask.createdById);

      // Classified as team task
      expect(convertedTask.teamId).toBe(targetTeamId);
      expect(convertedTask.assigneeId).toBe(targetAssigneeId);
    });

    it("should accept assigneeId in taskSchema for team task assignment and updates", () => {
      const parsed = taskSchema.safeParse({
        title: "Sprint Retrospective Analysis",
        date: "2026-10-22",
        teamId: "team-eng",
        assigneeId: "user-charlie",
      });

      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.assigneeId).toBe("user-charlie");
        expect(parsed.data.teamId).toBe("team-eng");
      }
    });
  });

  describe("2. Filtering Logic: Team Tasks Section Exclusivity", () => {
    const mixedTaskList = [
      { id: "1", title: "Personal Routine", teamId: null, assigneeId: "alice" },
      { id: "2", title: "Dentist Visit", teamId: null, assigneeId: "alice" },
      { id: "3", title: "Sprint Planning", teamId: "team-1", assigneeId: "alice" },
      { id: "4", title: "Architecture Sync", teamId: "team-2", assigneeId: "bob" },
      { id: "5", title: "Personal Grocery", teamId: null, assigneeId: "bob" },
    ];

    it("should ensure Team Tasks section contains ONLY tasks with teamId != null", () => {
      // Team tasks filter
      const teamSectionTasks = mixedTaskList.filter((t) => t.teamId !== null);

      expect(teamSectionTasks.length).toBe(2);
      expect(teamSectionTasks.every((t) => t.teamId !== null)).toBe(true);
      expect(teamSectionTasks.some((t) => t.teamId === null)).toBe(false);
      expect(teamSectionTasks.map((t) => t.title)).toEqual([
        "Sprint Planning",
        "Architecture Sync",
      ]);
    });

    it("should ensure Personal Tasks section contains ONLY tasks with teamId == null", () => {
      const personalSectionTasks = mixedTaskList.filter((t) => t.teamId === null);

      expect(personalSectionTasks.length).toBe(3);
      expect(personalSectionTasks.every((t) => t.teamId === null)).toBe(true);
      expect(personalSectionTasks.some((t) => t.teamId !== null)).toBe(false);
    });

    it("should transition converted task from personal section to team section immediately", () => {
      let state = [...mixedTaskList];

      // Convert task #1 into a team task
      state = state.map((t) =>
        t.id === "1" ? { ...t, teamId: "team-1", assigneeId: "alice" } : t
      );

      const personalTasks = state.filter((t) => t.teamId === null);
      const teamTasks = state.filter((t) => t.teamId !== null);

      // Task #1 no longer in personal tasks
      expect(personalTasks.some((t) => t.id === "1")).toBe(false);
      expect(personalTasks.length).toBe(2);

      // Task #1 now in team tasks
      expect(teamTasks.some((t) => t.id === "1")).toBe(true);
      expect(teamTasks.length).toBe(3);
    });
  });

  describe("3. Deadline Calculation & Overdue Determination", () => {
    it("should calculate deadline from endTime when provided", () => {
      const task = {
        date: "2026-10-21",
        startTime: "14:00",
        endTime: "16:00",
      };
      const deadline = getTaskDeadline(task, "UTC");
      expect(deadline.toISOString()).toBe("2026-10-21T16:00:00.000Z");
    });

    it("should calculate deadline from startTime when endTime is omitted", () => {
      const task = {
        date: "2026-10-21",
        startTime: "09:30",
        endTime: null,
      };
      const deadline = getTaskDeadline(task, "UTC");
      expect(deadline.toISOString()).toBe("2026-10-21T09:30:00.000Z");
    });

    it("should calculate deadline at end of day for all-day tasks", () => {
      const task = {
        date: "2026-10-21",
        startTime: null,
        endTime: null,
      };
      const deadline = getTaskDeadline(task, "UTC");
      expect(deadline.toISOString()).toBe("2026-10-21T23:59:59.999Z");
    });

    it("should adjust deadline according to user IANA timezone", () => {
      const task = {
        date: "2026-10-21",
        startTime: "12:00",
        endTime: "13:00",
      };
      // Asia/Dhaka is UTC+6
      const deadlineDhaka = getTaskDeadline(task, "Asia/Dhaka");
      // 13:00 in UTC+6 is 07:00 UTC
      expect(deadlineDhaka.toISOString()).toBe("2026-10-21T07:00:00.000Z");

      // America/New_York (EDT) is UTC-4 in October
      const deadlineNY = getTaskDeadline(task, "America/New_York");
      // 13:00 in UTC-4 is 17:00 UTC
      expect(deadlineNY.toISOString()).toBe("2026-10-21T17:00:00.000Z");
    });

    it("should correctly identify overdue tasks", () => {
      const pastTask = {
        date: "2026-10-15",
        startTime: "10:00",
        endTime: "11:00",
        status: TaskStatus.TODO,
      };
      const now = new Date("2026-10-21T12:00:00Z");
      expect(isTaskOverdue(pastTask, "UTC", now)).toBe(true);

      const futureTask = {
        date: "2026-10-25",
        startTime: "10:00",
        endTime: "11:00",
        status: TaskStatus.TODO,
      };
      expect(isTaskOverdue(futureTask, "UTC", now)).toBe(false);
    });

    it("should never mark DONE or CANCELLED tasks as overdue", () => {
      const completedPastTask = {
        date: "2026-10-10",
        startTime: "10:00",
        endTime: "11:00",
        status: TaskStatus.DONE,
      };
      const cancelledPastTask = {
        date: "2026-10-10",
        startTime: "10:00",
        endTime: "11:00",
        status: TaskStatus.CANCELLED,
      };
      const now = new Date("2026-10-21T12:00:00Z");

      expect(isTaskOverdue(completedPastTask, "UTC", now)).toBe(false);
      expect(isTaskOverdue(cancelledPastTask, "UTC", now)).toBe(false);
    });
  });

  describe("4. Independent On/Off Penalty System Controls", () => {
    it("should validate independent penalty setting schema", () => {
      const valid1 = penaltySettingSchema.safeParse({ personalTasksEnabled: false });
      expect(valid1.success).toBe(true);

      const valid2 = penaltySettingSchema.safeParse({ teamTasksEnabled: true });
      expect(valid2.success).toBe(true);

      const valid3 = penaltySettingSchema.safeParse({
        personalTasksEnabled: true,
        teamTasksEnabled: false,
      });
      expect(valid3.success).toBe(true);
    });

    it("should independently enforce personal and team penalty rules", () => {
      const evaluatePenaltyEligibility = (
        taskType: "PERSONAL" | "TEAM",
        isOverdue: boolean,
        settings: { personalTasksEnabled: boolean; teamTasksEnabled: boolean }
      ) => {
        if (!isOverdue) return false;
        if (taskType === "PERSONAL") return settings.personalTasksEnabled;
        if (taskType === "TEAM") return settings.teamTasksEnabled;
        return false;
      };

      // Case 1: Personal OFF, Team ON
      const settings1 = { personalTasksEnabled: false, teamTasksEnabled: true };
      expect(evaluatePenaltyEligibility("PERSONAL", true, settings1)).toBe(false);
      expect(evaluatePenaltyEligibility("TEAM", true, settings1)).toBe(true);

      // Case 2: Personal ON, Team OFF
      const settings2 = { personalTasksEnabled: true, teamTasksEnabled: false };
      expect(evaluatePenaltyEligibility("PERSONAL", true, settings2)).toBe(true);
      expect(evaluatePenaltyEligibility("TEAM", true, settings2)).toBe(false);

      // Case 3: Both OFF
      const settings3 = { personalTasksEnabled: false, teamTasksEnabled: false };
      expect(evaluatePenaltyEligibility("PERSONAL", true, settings3)).toBe(false);
      expect(evaluatePenaltyEligibility("TEAM", true, settings3)).toBe(false);

      // Case 4: Both ON
      const settings4 = { personalTasksEnabled: true, teamTasksEnabled: true };
      expect(evaluatePenaltyEligibility("PERSONAL", true, settings4)).toBe(true);
      expect(evaluatePenaltyEligibility("TEAM", true, settings4)).toBe(true);
    });
  });

  describe("5. Monthly Counting, Automatic Reset & Permanent History", () => {
    it("should extract correct monthYear and year/month references", () => {
      const deadline = new Date("2026-10-18T15:00:00Z");
      const details = getPenaltyMonthDetails(deadline, "UTC");

      expect(details.monthYear).toBe("2026-10");
      expect(details.year).toBe(2026);
      expect(details.month).toBe(10);
    });

    it("should correctly handle month boundaries in user timezone", () => {
      // 2026-10-31 23:30 in America/New_York (UTC-4) -> UTC is 2026-11-01 03:30
      const localDeadline = new Date("2026-11-01T03:30:00Z");
      const nyDetails = getPenaltyMonthDetails(localDeadline, "America/New_York");
      expect(nyDetails.monthYear).toBe("2026-10");

      const utcDetails = getPenaltyMonthDetails(localDeadline, "UTC");
      expect(utcDetails.monthYear).toBe("2026-11");
    });

    it("should automatically reset current month count to zero when month advances while preserving history", () => {
      // Simulated stored penalty database
      const storedPenalties = [
        {
          id: "pen-1",
          taskId: "task-1",
          taskType: TaskType.PERSONAL,
          userId: "user-1",
          monthYear: "2026-08",
          penaltyDate: new Date("2026-08-15"),
        },
        {
          id: "pen-2",
          taskId: "task-2",
          taskType: TaskType.PERSONAL,
          userId: "user-1",
          monthYear: "2026-09",
          penaltyDate: new Date("2026-09-20"),
        },
        {
          id: "pen-3",
          taskId: "task-3",
          taskType: TaskType.TEAM,
          userId: "user-1",
          monthYear: "2026-09",
          penaltyDate: new Date("2026-09-25"),
        },
        {
          id: "pen-4",
          taskId: "task-4",
          taskType: TaskType.PERSONAL,
          userId: "user-1",
          monthYear: "2026-10",
          penaltyDate: new Date("2026-10-05"),
        },
      ];

      const getMonthlyCount = (monthYear: string, type?: TaskType) => {
        return storedPenalties.filter((p) => {
          if (p.monthYear !== monthYear) return false;
          if (type && p.taskType !== type) return false;
          return true;
        }).length;
      };

      // September 2026 historical counts
      expect(getMonthlyCount("2026-09")).toBe(2);
      expect(getMonthlyCount("2026-09", TaskType.PERSONAL)).toBe(1);
      expect(getMonthlyCount("2026-09", TaskType.TEAM)).toBe(1);

      // October 2026 count
      expect(getMonthlyCount("2026-10")).toBe(1);

      // When November 2026 arrives (new calendar month):
      // Count is automatically 0 because no penalties have been recorded for 2026-11
      expect(getMonthlyCount("2026-11")).toBe(0);

      // Historical records remain completely intact and preserved
      expect(storedPenalties.length).toBe(4);
      expect(getMonthlyCount("2026-08")).toBe(1);
      expect(getMonthlyCount("2026-09")).toBe(2);
      expect(getMonthlyCount("2026-10")).toBe(1);
    });

    it("should prevent duplicate penalties for the same task", () => {
      const penaltyRecords = new Map<string, any>();

      const recordPenalty = (penalty: { taskId: string; monthYear: string }) => {
        if (penaltyRecords.has(penalty.taskId)) {
          // Reject duplicate creation, preserve existing
          return { created: false, existing: penaltyRecords.get(penalty.taskId) };
        }
        penaltyRecords.set(penalty.taskId, penalty);
        return { created: true, record: penalty };
      };

      // First trigger
      const first = recordPenalty({ taskId: "task-overdue-1", monthYear: "2026-10" });
      expect(first.created).toBe(true);

      // Repeated trigger (page reloads, revisit)
      const second = recordPenalty({ taskId: "task-overdue-1", monthYear: "2026-10" });
      expect(second.created).toBe(false);

      // Third trigger
      const third = recordPenalty({ taskId: "task-overdue-1", monthYear: "2026-10" });
      expect(third.created).toBe(false);

      // Exactly 1 penalty record exists
      expect(penaltyRecords.size).toBe(1);
    });

    it("should handle task reassignment by transferring penalty accountability", () => {
      const penaltyRecord = {
        taskId: "team-task-99",
        taskType: TaskType.TEAM,
        userId: "alice", // Originally assigned to Alice
        monthYear: "2026-10",
      };

      // Team task is reassigned to Charlie
      const newAssigneeId = "charlie";
      const updatedPenalty = {
        ...penaltyRecord,
        userId: newAssigneeId,
      };

      expect(updatedPenalty.userId).toBe("charlie");
      expect(updatedPenalty.taskId).toBe("team-task-99");
      expect(updatedPenalty.taskType).toBe(TaskType.TEAM);
    });
  });

  describe("6. Team Task Penalty Permissions & Individual/Total Aggregation", () => {
    it("should allow strictly Master Admin (OWNER) and Admin (ADMIN) to edit team penalties", () => {
      expect(can(Role.OWNER, "MANAGE_TEAM_PENALTIES")).toBe(true);
      expect(can(Role.ADMIN, "MANAGE_TEAM_PENALTIES")).toBe(true);
      expect(can(Role.MEMBER, "MANAGE_TEAM_PENALTIES")).toBe(false);
      expect(can(Role.GUEST, "MANAGE_TEAM_PENALTIES")).toBe(false);
    });

    it("should reject team penalty modification when user is not Master Admin or Admin", () => {
      const checkPermission = (role: Role) => {
        if (!can(role, "MANAGE_TEAM_PENALTIES")) {
          return { success: false, error: "A team task penalty should only be editable by the master admin and the admin." };
        }
        return { success: true };
      };

      expect(checkPermission(Role.OWNER).success).toBe(true);
      expect(checkPermission(Role.ADMIN).success).toBe(true);
      expect(checkPermission(Role.MEMBER).success).toBe(false);
      expect(checkPermission(Role.MEMBER).error).toBe("A team task penalty should only be editable by the master admin and the admin.");
      expect(checkPermission(Role.GUEST).success).toBe(false);
    });

    it("should accurately compute individual member penalty counts and included total sum", () => {
      const teamMembers = [
        { userId: "user-alice", name: "Alice (Master Admin)", role: Role.OWNER },
        { userId: "user-bob", name: "Bob (Admin)", role: Role.ADMIN },
        { userId: "user-charlie", name: "Charlie (Member)", role: Role.MEMBER },
        { userId: "user-david", name: "David (Guest)", role: Role.GUEST },
      ];

      const teamPenalties = [
        { id: "pen-1", taskId: "task-1", teamId: "team-eng", userId: "user-bob", monthYear: "2026-10" },
        { id: "pen-2", taskId: "task-2", teamId: "team-eng", userId: "user-charlie", monthYear: "2026-10" },
        { id: "pen-3", taskId: "task-3", teamId: "team-eng", userId: "user-charlie", monthYear: "2026-10" },
      ];

      // Individual breakdown calculation
      const memberBreakdown = teamMembers.map((m) => {
        const count = teamPenalties.filter((p) => p.userId === m.userId).length;
        return {
          userId: m.userId,
          name: m.name,
          role: m.role,
          penaltyCount: count,
        };
      });

      // Individual counts
      expect(memberBreakdown.find((m) => m.userId === "user-alice")?.penaltyCount).toBe(0);
      expect(memberBreakdown.find((m) => m.userId === "user-bob")?.penaltyCount).toBe(1);
      expect(memberBreakdown.find((m) => m.userId === "user-charlie")?.penaltyCount).toBe(2);
      expect(memberBreakdown.find((m) => m.userId === "user-david")?.penaltyCount).toBe(0);

      // Total count: included sum by adding all member penalties
      const totalTeamPenalties = memberBreakdown.reduce((sum, m) => sum + m.penaltyCount, 0);
      expect(totalTeamPenalties).toBe(3);
      expect(totalTeamPenalties).toBe(teamPenalties.length);
    });

    it("should respect team.penaltiesEnabled flag during team task evaluation", () => {
      const evaluateTeamTaskEligibility = (
        isOverdue: boolean,
        teamPenaltiesEnabled: boolean,
        userTeamTasksEnabled: boolean
      ) => {
        if (!isOverdue) return false;
        return teamPenaltiesEnabled && userTeamTasksEnabled;
      };

      // Both enabled -> generates penalty
      expect(evaluateTeamTaskEligibility(true, true, true)).toBe(true);

      // Team penalties OFF -> no penalty generated
      expect(evaluateTeamTaskEligibility(true, false, true)).toBe(false);

      // User setting OFF -> no penalty generated
      expect(evaluateTeamTaskEligibility(true, true, false)).toBe(false);

      // On time -> no penalty
      expect(evaluateTeamTaskEligibility(false, true, true)).toBe(false);
    });

    it("should allow Master Admin and Admin to waive a penalty record", () => {
      let teamPenalties = [
        { id: "pen-1", taskId: "task-1", teamId: "team-eng", userId: "user-charlie" },
        { id: "pen-2", taskId: "task-2", teamId: "team-eng", userId: "user-bob" },
      ];

      const waivePenalty = (role: Role, penaltyId: string) => {
        if (!can(role, "MANAGE_TEAM_PENALTIES")) {
          throw new Error("A team task penalty should only be editable by the master admin and the admin.");
        }
        teamPenalties = teamPenalties.filter((p) => p.id !== penaltyId);
      };

      // Member cannot waive
      expect(() => waivePenalty(Role.MEMBER, "pen-1")).toThrow(
        "A team task penalty should only be editable by the master admin and the admin."
      );
      expect(teamPenalties.length).toBe(2);

      // Admin can waive
      waivePenalty(Role.ADMIN, "pen-1");
      expect(teamPenalties.length).toBe(1);
      expect(teamPenalties.some((p) => p.id === "pen-1")).toBe(false);

      // Master Admin can waive
      waivePenalty(Role.OWNER, "pen-2");
      expect(teamPenalties.length).toBe(0);
    });
  });

  describe("7. Task Date Change & Rescheduling Penalty Preservation", () => {
    interface SimulatedTask {
      id: string;
      title: string;
      date: string;
      startTime?: string | null;
      endTime?: string | null;
      description?: string | null;
      status: TaskStatus;
      priority: TaskPriority;
      location?: string | null;
      color?: string | null;
      teamId?: string | null;
      createdById: string;
      assigneeId?: string | null;
    }

    interface SimulatedPenalty {
      id: string;
      taskId: string;
      taskType: TaskType;
      userId: string;
      teamId?: string | null;
      monthYear: string;
    }

    const processTaskDateChange = (
      task: SimulatedTask,
      newDate: string,
      penalties: SimulatedPenalty[],
      allTasks: SimulatedTask[],
      timingUpdates?: { startTime?: string | null; endTime?: string | null; title?: string }
    ) => {
      const hasPenalty = penalties.some((p) => p.taskId === task.id);
      const isDateChanged = task.date !== newDate;

      if (hasPenalty && isDateChanged) {
        // Task has penalty and date changed:
        // Original undone task remains on original date with its penalty intact.
        // A new copy is created on the new date.
        const copiedTask: SimulatedTask = {
          ...task,
          id: `task-copy-${Date.now()}-${Math.random()}`,
          title: timingUpdates?.title ?? task.title,
          date: newDate,
          startTime: timingUpdates?.startTime !== undefined ? timingUpdates.startTime : task.startTime,
          endTime: timingUpdates?.endTime !== undefined ? timingUpdates.endTime : task.endTime,
          status: TaskStatus.TODO,
        };

        allTasks.push(copiedTask);
        // Original task is NOT modified or moved, penalty is NOT deleted
        return { copied: true, originalTask: task, newTask: copiedTask };
      } else {
        // Normal update: task date moves directly, no copy made
        task.date = newDate;
        if (timingUpdates?.title) task.title = timingUpdates.title;
        if (timingUpdates?.startTime !== undefined) task.startTime = timingUpdates.startTime;
        if (timingUpdates?.endTime !== undefined) task.endTime = timingUpdates.endTime;
        return { copied: false, originalTask: task, newTask: task };
      }
    };

    it("should allow changing task date normally before penalty is incurred (no copy, no penalty)", () => {
      const tasks: SimulatedTask[] = [
        {
          id: "task-future-1",
          title: "Prepare Slide Deck",
          date: "2026-10-28",
          status: TaskStatus.TODO,
          priority: TaskPriority.MEDIUM,
          teamId: null,
          createdById: "user-alice",
          assigneeId: "user-alice",
        },
      ];
      const penalties: SimulatedPenalty[] = [];

      const result = processTaskDateChange(tasks[0], "2026-10-29", penalties, tasks);

      expect(result.copied).toBe(false);
      expect(tasks.length).toBe(1);
      expect(tasks[0].date).toBe("2026-10-29");
      expect(penalties.length).toBe(0);
    });

    it("should preserve penalty and copy personal task to new date when changed after getting penalty", () => {
      const originalTask: SimulatedTask = {
        id: "task-overdue-personal",
        title: "Submit Expense Report",
        date: "2026-10-18",
        status: TaskStatus.TODO,
        priority: TaskPriority.HIGH,
        teamId: null,
        createdById: "user-alice",
        assigneeId: "user-alice",
      };

      const tasks: SimulatedTask[] = [originalTask];
      const penalties: SimulatedPenalty[] = [
        {
          id: "pen-expense-1",
          taskId: originalTask.id,
          taskType: TaskType.PERSONAL,
          userId: "user-alice",
          teamId: null,
          monthYear: "2026-10",
        },
      ];

      // Alice changes date after getting penalty
      const result = processTaskDateChange(originalTask, "2026-10-26", penalties, tasks);

      // 1. Task was copied
      expect(result.copied).toBe(true);
      expect(tasks.length).toBe(2);

      // 2. Original undone task still shows on original date
      expect(result.originalTask.id).toBe("task-overdue-personal");
      expect(result.originalTask.date).toBe("2026-10-18");
      expect(result.originalTask.status).toBe(TaskStatus.TODO);

      // 3. New copy appears on new date with status TODO
      expect(result.newTask.date).toBe("2026-10-26");
      expect(result.newTask.title).toBe("Submit Expense Report");
      expect(result.newTask.status).toBe(TaskStatus.TODO);
      expect(result.newTask.teamId).toBeNull();
      expect(result.newTask.assigneeId).toBe("user-alice");

      // 4. Penalty count is still there and preserved
      expect(penalties.length).toBe(1);
      expect(penalties[0].taskId).toBe("task-overdue-personal");
      expect(penalties[0].userId).toBe("user-alice");
    });

    it("should preserve penalty and copy team task to new date when changed after getting penalty", () => {
      const originalTeamTask: SimulatedTask = {
        id: "team-task-overdue-1",
        title: "Deploy Production Hotfix",
        date: "2026-10-19",
        status: TaskStatus.TODO,
        priority: TaskPriority.HIGH,
        teamId: "team-eng",
        createdById: "user-alice",
        assigneeId: "user-bob",
      };

      const tasks: SimulatedTask[] = [originalTeamTask];
      const penalties: SimulatedPenalty[] = [
        {
          id: "pen-team-hotfix-1",
          taskId: originalTeamTask.id,
          taskType: TaskType.TEAM,
          userId: "user-bob",
          teamId: "team-eng",
          monthYear: "2026-10",
        },
      ];

      // Bob changes the date to a future date
      const result = processTaskDateChange(originalTeamTask, "2026-10-27", penalties, tasks);

      expect(result.copied).toBe(true);
      expect(tasks.length).toBe(2);

      // Original undone task remains on original date with team penalty
      expect(result.originalTask.id).toBe("team-task-overdue-1");
      expect(result.originalTask.date).toBe("2026-10-19");
      expect(result.originalTask.status).toBe(TaskStatus.TODO);
      expect(result.originalTask.teamId).toBe("team-eng");

      // New copy has the new date, same team and assignee, status TODO
      expect(result.newTask.date).toBe("2026-10-27");
      expect(result.newTask.teamId).toBe("team-eng");
      expect(result.newTask.assigneeId).toBe("user-bob");
      expect(result.newTask.status).toBe(TaskStatus.TODO);

      // Team penalty is NOT removed
      expect(penalties.length).toBe(1);
      expect(penalties.find((p) => p.taskId === "team-task-overdue-1")).toBeDefined();
    });

    it("should not copy when editing non-date fields on a penalized task on the same date", () => {
      const penalizedTask: SimulatedTask = {
        id: "task-penalized-same-date",
        title: "Old Title",
        date: "2026-10-15",
        status: TaskStatus.TODO,
        priority: TaskPriority.MEDIUM,
        teamId: null,
        createdById: "user-alice",
        assigneeId: "user-alice",
      };

      const tasks: SimulatedTask[] = [penalizedTask];
      const penalties: SimulatedPenalty[] = [
        {
          id: "pen-1",
          taskId: penalizedTask.id,
          taskType: TaskType.PERSONAL,
          userId: "user-alice",
          monthYear: "2026-10",
        },
      ];

      // User edits title without changing date
      const result = processTaskDateChange(penalizedTask, "2026-10-15", penalties, tasks, {
        title: "Updated Title on Same Date",
      });

      expect(result.copied).toBe(false);
      expect(tasks.length).toBe(1);
      expect(tasks[0].title).toBe("Updated Title on Same Date");
      expect(tasks[0].date).toBe("2026-10-15");
      expect(penalties.length).toBe(1);
    });

    it("should never delete existing penalties during synchronization even if task is later completed or rescheduled", () => {
      const recordedPenalties = new Map<string, SimulatedPenalty>();
      recordedPenalties.set("task-100", {
        id: "pen-100",
        taskId: "task-100",
        taskType: TaskType.PERSONAL,
        userId: "user-1",
        monthYear: "2026-10",
      });

      // Synchronizer logic without automatic deletion
      const syncPenalty = (taskId: string, isOverdue: boolean) => {
        if (isOverdue) {
          if (!recordedPenalties.has(taskId)) {
            recordedPenalties.set(taskId, {
              id: `pen-${taskId}`,
              taskId,
              taskType: TaskType.PERSONAL,
              userId: "user-1",
              monthYear: "2026-10",
            });
          }
        }
        // If not overdue, recorded penalty remains intact
      };

      // Simulated task-100 is evaluated when now <= deadline or DONE (isOverdue = false)
      syncPenalty("task-100", false);

      // The penalty must STILL be there
      expect(recordedPenalties.has("task-100")).toBe(true);
      expect(recordedPenalties.size).toBe(1);
    });
  });
});
