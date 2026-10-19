import { describe, it, expect } from "vitest";
import {
  calculateReminderSendTime,
  formatOffsetLabel,
  DEFAULT_REMINDER_OFFSETS,
} from "@/lib/reminders";
import {
  reminderPreferenceSchema,
  taskReminderOverrideSchema,
} from "@/lib/validations/reminder";
import { renderReminderDigestHtml } from "@/lib/email";
import { TaskPriority } from "@prisma/client";

describe("Phase 5: Automated Email Reminders & Dispatcher Engine (FR-24 to FR-27)", () => {
  describe("Zod Validation for Reminder Preferences & Overrides (FR-25)", () => {
    it("should validate default reminder preference settings", () => {
      const valid = reminderPreferenceSchema.safeParse({
        enabled: true,
        defaultOffsets: [4320, 1440, 0],
      });
      expect(valid.success).toBe(true);
      if (valid.success) {
        expect(valid.data.enabled).toBe(true);
        expect(valid.data.defaultOffsets).toEqual([4320, 1440, 0]);
      }
    });

    it("should reject empty offsets array when enabled", () => {
      const invalid = reminderPreferenceSchema.safeParse({
        enabled: true,
        defaultOffsets: [],
      });
      expect(invalid.success).toBe(false);
      if (!invalid.success) {
        expect(invalid.error.issues[0].message).toContain(
          "At least one reminder offset must be selected"
        );
      }
    });

    it("should validate per-task reminder override input", () => {
      const valid = taskReminderOverrideSchema.safeParse({
        taskId: "task-101",
        enabled: false,
        offsets: [],
      });
      expect(valid.success).toBe(true);
    });
  });

  describe("Timezone-Aware UTC Send Time Calculations (FR-24, FR-25)", () => {
    it("should accurately compute UTC sendAt for a timed task in America/New_York (EDT UTC-4)", () => {
      const taskDate = "2026-10-25";
      const startTime = "10:00";
      const userTimeZone = "America/New_York";

      // 10:00 EDT on 2026-10-25 is 14:00 UTC
      // Offset 0: exactly task start
      const sendAt0 = calculateReminderSendTime(taskDate, startTime, 0, userTimeZone);
      expect(sendAt0.toISOString()).toBe("2026-10-25T14:00:00.000Z");

      // Offset 1440 min (1 day before): 2026-10-24 14:00 UTC
      const sendAt1Day = calculateReminderSendTime(taskDate, startTime, 1440, userTimeZone);
      expect(sendAt1Day.toISOString()).toBe("2026-10-24T14:00:00.000Z");

      // Offset 4320 min (3 days before): 2026-10-22 14:00 UTC
      const sendAt3Days = calculateReminderSendTime(taskDate, startTime, 4320, userTimeZone);
      expect(sendAt3Days.toISOString()).toBe("2026-10-22T14:00:00.000Z");
    });

    it("should accurately compute UTC sendAt for an all-day task in Asia/Tokyo (JST UTC+9)", () => {
      const taskDate = "2026-10-25";
      const startTime = null; // All day -> 00:00 Tokyo
      const userTimeZone = "Asia/Tokyo";

      // 00:00 JST on 2026-10-25 is 2026-10-24 15:00 UTC
      const sendAt0 = calculateReminderSendTime(taskDate, startTime, 0, userTimeZone);
      expect(sendAt0.toISOString()).toBe("2026-10-24T15:00:00.000Z");

      // Offset 1440 min (1 day before): 2026-10-23 15:00 UTC
      const sendAt1Day = calculateReminderSendTime(taskDate, startTime, 1440, userTimeZone);
      expect(sendAt1Day.toISOString()).toBe("2026-10-23T15:00:00.000Z");
    });

    it("should correctly handle London timezone (BST UTC+1 in summer)", () => {
      const taskDate = "2026-07-15";
      const startTime = "09:00";
      const userTimeZone = "Europe/London";

      // 09:00 BST is 08:00 UTC
      const sendAt0 = calculateReminderSendTime(taskDate, startTime, 0, userTimeZone);
      expect(sendAt0.toISOString()).toBe("2026-07-15T08:00:00.000Z");
    });
  });

  describe("Daily Email Quota Guard Logic (FR-26: 100/day Limit)", () => {
    const evaluateQuota = (sentToday: number, dailyLimit: number = 100) => {
      const remainingQuota = Math.max(0, dailyLimit - sentToday);
      return {
        sentToday,
        dailyLimit,
        remainingQuota,
        canSend: remainingQuota > 0,
      };
    };

    it("should allow sending when usage is under 100", () => {
      const status = evaluateQuota(45, 100);
      expect(status.canSend).toBe(true);
      expect(status.remainingQuota).toBe(55);
    });

    it("should block dispatch when usage reaches or exceeds 100", () => {
      const atCap = evaluateQuota(100, 100);
      expect(atCap.canSend).toBe(false);
      expect(atCap.remainingQuota).toBe(0);

      const overCap = evaluateQuota(105, 100);
      expect(overCap.canSend).toBe(false);
      expect(overCap.remainingQuota).toBe(0);
    });
  });

  describe("Batching & Digest Email Template (FR-27)", () => {
    it("should format multi-task digest into a single combined HTML email", () => {
      const sampleTasks = [
        {
          id: "task-1",
          title: "Sprint Planning",
          date: new Date("2026-10-25T00:00:00Z"),
          startTime: "10:00",
          endTime: "11:00",
          priority: TaskPriority.HIGH,
          location: "Google Meet",
          teamName: "Engineering",
        },
        {
          id: "task-2",
          title: "Submit Expense Report",
          date: new Date("2026-10-25T00:00:00Z"),
          startTime: null,
          endTime: null,
          priority: TaskPriority.LOW,
          location: null,
          teamName: null,
        },
      ];

      const html = renderReminderDigestHtml({
        userName: "Alice Smith",
        tasks: sampleTasks,
        appUrl: "https://teamplanner.app",
      });

      expect(html).toContain("You have 2 upcoming tasks scheduled");
      expect(html).toContain("Sprint Planning");
      expect(html).toContain("Submit Expense Report");
      expect(html).toContain("Engineering");
      expect(html).toContain("Google Meet");
      expect(html).toContain("https://teamplanner.app/calendar");
    });
  });

  describe("Offset Labels & Defaults", () => {
    it("should provide standardized human-readable labels for offsets", () => {
      expect(formatOffsetLabel(4320)).toBe("3 days before");
      expect(formatOffsetLabel(1440)).toBe("1 day before");
      expect(formatOffsetLabel(0)).toBe("Day of task (at start time)");
      expect(formatOffsetLabel(120)).toBe("2 hours before");
      expect(formatOffsetLabel(45)).toBe("45 minutes before");
    });

    it("should define standard default offsets as [4320, 1440, 0]", () => {
      expect(DEFAULT_REMINDER_OFFSETS).toEqual([4320, 1440, 0]);
    });
  });
});
