import { describe, it, expect } from "vitest";
import { taskSchema, convertPersonalTaskSchema } from "@/lib/validations/task";
import { TaskStatus, TaskPriority } from "@prisma/client";

describe("Multi-Assignee Team Tasks Feature", () => {
  describe("Task Schema Validation with Multiple Assignees", () => {
    it("should accept a task with multiple assignee IDs", () => {
      const result = taskSchema.safeParse({
        title: "Sprint Planning Session",
        date: "2026-10-28",
        status: TaskStatus.TODO,
        priority: TaskPriority.HIGH,
        teamId: "team-123",
        assigneeIds: ["user-alice", "user-bob", "user-charlie"],
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.assigneeIds).toEqual(["user-alice", "user-bob", "user-charlie"]);
      }
    });

    it("should accept a task with both legacy assigneeId and new assigneeIds", () => {
      const result = taskSchema.safeParse({
        title: "Cross-functional Review",
        date: "2026-10-28",
        status: TaskStatus.TODO,
        priority: TaskPriority.MEDIUM,
        teamId: "team-123",
        assigneeId: "user-alice",
        assigneeIds: ["user-alice", "user-bob"],
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.assigneeId).toBe("user-alice");
        expect(result.data.assigneeIds).toHaveLength(2);
      }
    });

    it("should accept a task without assigneeIds (backwards compatibility)", () => {
      const result = taskSchema.safeParse({
        title: "Personal Task",
        date: "2026-10-28",
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.assigneeIds).toBeUndefined();
      }
    });

    it("should accept convertPersonalTaskSchema with multiple assigneeIds", () => {
      const result = convertPersonalTaskSchema.safeParse({
        taskId: "task-100",
        teamId: "team-alpha",
        assigneeIds: ["user-1", "user-2"],
        assigneeId: "user-1",
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.taskId).toBe("task-100");
        expect(result.data.teamId).toBe("team-alpha");
        expect(result.data.assigneeIds).toEqual(["user-1", "user-2"]);
      }
    });
  });

  describe("Multi-Assignee Filtering Logic (Assigned to Me / Others)", () => {
    const mockTasks = [
      {
        id: "t-1",
        title: "Joint Design Review",
        teamId: "team-1",
        assigneeId: "user-alice",
        assignees: [
          { id: "user-alice", name: "Alice", email: "alice@example.com" },
          { id: "user-bob", name: "Bob", email: "bob@example.com" },
        ],
      },
      {
        id: "t-2",
        title: "Solo Charlie Task",
        teamId: "team-1",
        assigneeId: "user-charlie",
        assignees: [
          { id: "user-charlie", name: "Charlie", email: "charlie@example.com" },
        ],
      },
      {
        id: "t-3",
        title: "Legacy Task (Only assigneeId)",
        teamId: "team-1",
        assigneeId: "user-alice",
        assignees: [],
      },
      {
        id: "t-4",
        title: "All-Hands Team Task",
        teamId: "team-1",
        assigneeId: "user-alice",
        assignees: [
          { id: "user-alice", name: "Alice", email: "alice@example.com" },
          { id: "user-bob", name: "Bob", email: "bob@example.com" },
          { id: "user-charlie", name: "Charlie", email: "charlie@example.com" },
        ],
      },
    ];

    const filterTasksByAssignment = (
      tasks: typeof mockTasks,
      filter: "ALL" | "ME" | "OTHERS",
      currentUserId: string
    ) => {
      if (filter === "ALL") return tasks;

      return tasks.filter((t) => {
        const isAssignedToMe =
          (Array.isArray(t.assignees) && t.assignees.some((a) => a.id === currentUserId)) ||
          t.assigneeId === currentUserId;

        if (filter === "ME") return isAssignedToMe;
        if (filter === "OTHERS") return !isAssignedToMe;
        return true;
      });
    };

    it("should filter correctly when Bob views 'Assigned to Me'", () => {
      const bobTasks = filterTasksByAssignment(mockTasks, "ME", "user-bob");
      // Bob is on Joint Design Review (t-1) and All-Hands (t-4)
      expect(bobTasks.map((t) => t.id)).toEqual(["t-1", "t-4"]);
    });

    it("should filter correctly when Bob views 'Assigned to Others'", () => {
      const othersTasks = filterTasksByAssignment(mockTasks, "OTHERS", "user-bob");
      // Tasks not assigned to Bob: t-2 (Charlie) and t-3 (Alice only)
      expect(othersTasks.map((t) => t.id)).toEqual(["t-2", "t-3"]);
    });

    it("should filter correctly when Charlie views 'Assigned to Me'", () => {
      const charlieTasks = filterTasksByAssignment(mockTasks, "ME", "user-charlie");
      // Charlie is on t-2 and t-4
      expect(charlieTasks.map((t) => t.id)).toEqual(["t-2", "t-4"]);
    });

    it("should filter correctly for legacy task with only assigneeId", () => {
      const aliceTasks = filterTasksByAssignment(mockTasks, "ME", "user-alice");
      // Alice is on t-1, t-3 (via legacy assigneeId), and t-4
      expect(aliceTasks.map((t) => t.id)).toEqual(["t-1", "t-3", "t-4"]);
    });
  });

  describe("Assignee Normalization and Deduplication", () => {
    it("should handle normalization with fallback to single assignee", () => {
      const taskWithJoinRecords = {
        assignees: [
          { user: { id: "u-1", name: "User One", email: "u1@test.com" } },
          { user: { id: "u-2", name: "User Two", email: "u2@test.com" } },
        ],
        assignee: { id: "u-1", name: "User One", email: "u1@test.com" },
      };

      const normalizedList =
        taskWithJoinRecords.assignees && taskWithJoinRecords.assignees.length > 0
          ? taskWithJoinRecords.assignees.map((a) => a.user)
          : taskWithJoinRecords.assignee
          ? [taskWithJoinRecords.assignee]
          : [];

      expect(normalizedList).toHaveLength(2);
      expect(normalizedList[0].id).toBe("u-1");
      expect(normalizedList[1].id).toBe("u-2");
    });

    it("should fallback to primary assignee when join records are empty", () => {
      const legacyTask = {
        assignees: [],
        assignee: { id: "u-legacy", name: "Legacy User", email: "legacy@test.com" },
      };

      const normalizedList =
        legacyTask.assignees && legacyTask.assignees.length > 0
          ? legacyTask.assignees.map((a: any) => a.user)
          : legacyTask.assignee
          ? [legacyTask.assignee]
          : [];

      expect(normalizedList).toHaveLength(1);
      expect(normalizedList[0].id).toBe("u-legacy");
    });

    it("should deduplicate target assignee IDs before creating records", () => {
      const rawInputIds = ["user-1", "user-2", "user-1", "user-3", "user-2"];
      const targetAssigneeIds = Array.from(new Set(rawInputIds.filter(Boolean)));

      expect(targetAssigneeIds).toEqual(["user-1", "user-2", "user-3"]);
      expect(targetAssigneeIds[0]).toBe("user-1"); // Primary assignee preserved
    });
  });
});
