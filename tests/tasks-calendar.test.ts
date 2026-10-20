import { describe, it, expect } from "vitest";
import { taskSchema, rescheduleTaskSchema, batchTasksSchema } from "@/lib/validations/task";
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
});
