import { describe, it, expect } from "vitest";
import { taskSchema, rescheduleTaskSchema, batchTasksSchema, calendarViewSchema, CalendarViewMode } from "@/lib/validations/task";
import {
  formatTaskTiming,
  getMonthDays,
  getWeekDays,
  toDateString,
  parseDateString,
} from "@/lib/date-utils";
import { TaskStatus, TaskPriority } from "@prisma/client";

describe("Phase 1: Tasks and Calendar Tests (FR-03 to FR-09)", () => {
  describe("FR-04 & FR-05: Timing Rules & Schema Validation", () => {
    it("should accept valid all-day tasks (date only)", () => {
      const result = taskSchema.safeParse({
        title: "All-Day Strategy Review",
        date: "2026-10-20",
        description: "Full day offsite strategy",
        status: TaskStatus.TODO,
        priority: TaskPriority.HIGH,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.title).toBe("All-Day Strategy Review");
        expect(result.data.startTime).toBeUndefined();
        expect(result.data.endTime).toBeUndefined();
      }
    });

    it("should accept valid start-time only tasks", () => {
      const result = taskSchema.safeParse({
        title: "Standup Sync",
        date: "2026-10-20",
        startTime: "09:30",
        status: TaskStatus.IN_PROGRESS,
        priority: TaskPriority.MEDIUM,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.startTime).toBe("09:30");
        expect(result.data.endTime).toBeFalsy();
      }
    });

    it("should accept valid time range tasks where endTime > startTime", () => {
      const result = taskSchema.safeParse({
        title: "Architecture Planning",
        date: "2026-10-20",
        startTime: "14:00",
        endTime: "15:30",
        status: TaskStatus.TODO,
        priority: TaskPriority.HIGH,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.startTime).toBe("14:00");
        expect(result.data.endTime).toBe("15:30");
      }
    });

    it("should reject tasks where endTime is specified without startTime", () => {
      const result = taskSchema.safeParse({
        title: "Invalid Task Missing Start",
        date: "2026-10-20",
        endTime: "16:00",
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        const issues = result.error.issues;
        expect(issues.some((i) => i.path.includes("startTime"))).toBe(true);
      }
    });

    it("should reject tasks where endTime is earlier than startTime", () => {
      const result = taskSchema.safeParse({
        title: "Invalid Backward Time Task",
        date: "2026-10-20",
        startTime: "15:00",
        endTime: "14:00",
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        const issues = result.error.issues;
        expect(issues.some((i) => i.path.includes("endTime"))).toBe(true);
      }
    });

    it("should reject tasks where endTime is equal to startTime", () => {
      const result = taskSchema.safeParse({
        title: "Invalid Zero Duration Task",
        date: "2026-10-20",
        startTime: "10:00",
        endTime: "10:00",
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        const issues = result.error.issues;
        expect(issues.some((i) => i.path.includes("endTime"))).toBe(true);
      }
    });

    it("should validate reschedule inputs strictly", () => {
      // Valid reschedule
      const valid = rescheduleTaskSchema.safeParse({
        taskId: "task-123",
        date: "2026-10-25",
        startTime: "11:00",
        endTime: "12:00",
      });
      expect(valid.success).toBe(true);

      // Invalid reschedule (endTime < startTime)
      const invalid = rescheduleTaskSchema.safeParse({
        taskId: "task-123",
        date: "2026-10-25",
        startTime: "11:00",
        endTime: "10:00",
      });
      expect(invalid.success).toBe(false);
    });

    it("should accept scheduling multiple tasks on same or different dates, personal and team mixed", () => {
      const batchInput = [
        {
          title: "Personal Morning Routine",
          date: "2026-10-20",
          startTime: "07:00",
          endTime: "08:00",
          teamId: null, // Personal task
        },
        {
          title: "Team Standup",
          date: "2026-10-20", // Same date
          startTime: "09:30",
          endTime: "10:00",
          teamId: "team-eng-1", // Team task
        },
        {
          title: "Client Presentation",
          date: "2026-10-22", // Different date
          startTime: "14:00",
          endTime: "15:30",
          teamId: "team-sales-2", // Different team task
        },
        {
          title: "Personal Gym Workout",
          date: "2026-10-22", // Different date, personal
          startTime: "18:00",
          teamId: null,
        },
      ];

      const result = batchTasksSchema.safeParse(batchInput);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.length).toBe(4);
        expect(result.data[0].teamId).toBeNull();
        expect(result.data[1].teamId).toBe("team-eng-1");
        expect(result.data[2].date).toBe("2026-10-22");
        expect(result.data[3].startTime).toBe("18:00");
      }
    });

    it("should reject batch if any task has invalid timing or missing title", () => {
      const invalidBatch = [
        {
          title: "Valid Task",
          date: "2026-10-20",
        },
        {
          title: "", // Missing title
          date: "2026-10-20",
        },
      ];

      const result = batchTasksSchema.safeParse(invalidBatch);
      expect(result.success).toBe(false);
    });
  });

  describe("FR-07: Calendar Layout and Formatting Utilities", () => {
    it("should generate 7-column grid days for Month view", () => {
      const targetDate = new Date(2026, 9, 1); // October 2026
      const monthDays = getMonthDays(targetDate);

      // Calendar grids must be multiples of 7
      expect(monthDays.length % 7).toBe(0);
      expect(monthDays.length).toBeGreaterThanOrEqual(28);
    });

    it("should generate exactly 7 days for Week view", () => {
      const targetDate = new Date(2026, 9, 19);
      const weekDays = getWeekDays(targetDate);

      expect(weekDays.length).toBe(7);
    });

    it("should format task timing according to FR-05 requirements", () => {
      expect(formatTaskTiming(null, null)).toBe("All day");
      expect(formatTaskTiming(undefined, undefined)).toBe("All day");
      expect(formatTaskTiming("09:00", null)).toBe("09:00");
      expect(formatTaskTiming("09:00", "10:30")).toBe("09:00 – 10:30");
    });

    it("should parse and format date strings safely", () => {
      const dateStr = "2026-10-19";
      const parsed = parseDateString(dateStr);
      expect(toDateString(parsed)).toBe(dateStr);
    });
  });

  describe("Team Task Visual Indicator Across All Calendar View Modes (Month, Week, Day, Agenda)", () => {
    const isTeamTask = (task: { teamId?: string | null; team?: any }) => {
      return !!(task.team || task.teamId);
    };

    it("should identify team task whenever team or teamId is present", () => {
      expect(isTeamTask({ teamId: "team-1", team: { name: "Engineering" } })).toBe(true);
      expect(isTeamTask({ teamId: "team-1" })).toBe(true);
      expect(isTeamTask({ team: { name: "Design" } })).toBe(true);
    });

    it("should identify personal task whenever team and teamId are absent or null", () => {
      expect(isTeamTask({ teamId: null, team: null })).toBe(false);
      expect(isTeamTask({ teamId: null })).toBe(false);
      expect(isTeamTask({})).toBe(false);
    });

    it("should consistently differentiate team vs personal tasks across month, week, day, and agenda datasets", () => {
      const sampleTasks = [
        { id: "1", title: "Personal Grocery", teamId: null, team: null },
        { id: "2", title: "Sprint Sync", teamId: "team-1", team: { name: "Engineering" } },
        { id: "3", title: "Team Retro", teamId: "team-2", team: null },
        { id: "4", title: "Dentist Visit", teamId: null, team: null },
      ];

      const teamTasks = sampleTasks.filter(isTeamTask);
      const personalTasks = sampleTasks.filter((t) => !isTeamTask(t));

      expect(teamTasks.map((t) => t.id)).toEqual(["2", "3"]);
      expect(personalTasks.map((t) => t.id)).toEqual(["1", "4"]);
    });
  });

  describe("Flexible Default Calendar View Filtering (Month, Week, Day, Agenda)", () => {
    it("should validate all 4 allowed view filter modes", () => {
      const allowedModes: CalendarViewMode[] = ["month", "week", "day", "agenda"];
      for (const mode of allowedModes) {
        const result = calendarViewSchema.safeParse(mode);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data).toBe(mode);
        }
      }
    });

    it("should reject invalid view filter modes", () => {
      const invalidModes = ["year", "quarter", "workweek", "list", "", "random"];
      for (const mode of invalidModes) {
        const result = calendarViewSchema.safeParse(mode);
        expect(result.success).toBe(false);
      }
    });

    it("should correctly resolve initial calendar view based on user preference and fallback", () => {
      const resolveView = (userPref?: string | null, queryParam?: string | null): CalendarViewMode => {
        const validModes: CalendarViewMode[] = ["month", "week", "day", "agenda"];
        if (queryParam && validModes.includes(queryParam as CalendarViewMode)) {
          return queryParam as CalendarViewMode;
        }
        if (userPref && validModes.includes(userPref as CalendarViewMode)) {
          return userPref as CalendarViewMode;
        }
        return "month";
      };

      // Default with no settings -> month
      expect(resolveView(undefined, undefined)).toBe("month");
      expect(resolveView(null, null)).toBe("month");
      expect(resolveView("invalid", null)).toBe("month");

      // User preference set to week
      expect(resolveView("week", undefined)).toBe("week");

      // User preference set to day
      expect(resolveView("day", undefined)).toBe("day");

      // User preference set to agenda
      expect(resolveView("agenda", undefined)).toBe("agenda");

      // User preference set to month
      expect(resolveView("month", undefined)).toBe("month");

      // URL query parameter takes priority for temporary navigation
      expect(resolveView("week", "day")).toBe("day");
      expect(resolveView("day", "agenda")).toBe("agenda");
      expect(resolveView("agenda", "month")).toBe("month");
      expect(resolveView("month", "week")).toBe("week");

      // Invalid query parameter falls back to user preference
      expect(resolveView("week", "invalid")).toBe("week");
      expect(resolveView("day", "")).toBe("day");
    });
  });

  describe("Dynamic Calendar Timestamp Row Elimination (Week & Day Views)", () => {
    const extractActiveHours = (tasks: Array<{ startTime?: string | null }>) => {
      const timedTasks = tasks.filter((t) => !!t.startTime);
      return Array.from(
        new Set(
          timedTasks.map((t) => {
            const h = parseInt(t.startTime!.split(":")[0], 10);
            return `${String(h).padStart(2, "0")}:00`;
          })
        )
      ).sort((a, b) => parseInt(a, 10) - parseInt(b, 10));
    };

    it("should return zero active hour rows when all tasks are all-day tasks", () => {
      const allDayTasks = [
        { id: "1", title: "LinkedIn Post", startTime: null },
        { id: "2", title: "Math Assignment", startTime: null },
        { id: "3", title: "Video on X", startTime: null },
      ];

      const activeHours = extractActiveHours(allDayTasks);
      expect(activeHours).toHaveLength(0);
      expect(activeHours).toEqual([]);
    });

    it("should return ONLY hours that have scheduled tasks, completely omitting empty hours", () => {
      const mixedTasks = [
        { id: "1", title: "Morning Standup", startTime: "09:30" },
        { id: "2", title: "Design Review", startTime: "14:00" },
        { id: "3", title: "Quick Followup", startTime: "14:45" },
        { id: "4", title: "All Day Prep", startTime: null },
      ];

      const activeHours = extractActiveHours(mixedTasks);
      // Only 09:00 and 14:00 should be active hours
      expect(activeHours).toEqual(["09:00", "14:00"]);
      // Non-scheduled hours (07:00, 08:00, 10:00, 11:00, 12:00, 13:00, 15:00... 21:00) must NOT be present
      expect(activeHours).not.toContain("07:00");
      expect(activeHours).not.toContain("08:00");
      expect(activeHours).not.toContain("10:00");
      expect(activeHours).not.toContain("11:00");
      expect(activeHours).not.toContain("12:00");
      expect(activeHours).not.toContain("13:00");
      expect(activeHours).not.toContain("15:00");
      expect(activeHours).not.toContain("20:00");
    });

    it("should sort active hour rows chronologically", () => {
      const scatteredTasks = [
        { id: "1", title: "Late Task", startTime: "21:00" },
        { id: "2", title: "Early Task", startTime: "07:15" },
        { id: "3", title: "Noon Task", startTime: "12:30" },
      ];

      const activeHours = extractActiveHours(scatteredTasks);
      expect(activeHours).toEqual(["07:00", "12:00", "21:00"]);
    });
  });
});
