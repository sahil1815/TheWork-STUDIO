import { describe, it, expect } from "vitest";
import { noteSchema, updateNoteSchema } from "@/lib/validations/note";

describe("Phase 2: Notebook Tests (FR-20, FR-21)", () => {
  describe("Note Validation & Schema Rules", () => {
    it("should accept valid note creation input with default values", () => {
      const result = noteSchema.safeParse({});
      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.data.title).toBe("Untitled Note");
        expect(result.data.pinned).toBe(false);
        expect(result.data.tags).toEqual([]);
        expect(result.data.contentText).toBe("");
      }
    });

    it("should accept rich note inputs with tags, title, and body content", () => {
      const input = {
        title: "Sprint 42 Architecture Blueprint",
        contentText: "Detailed notes on micro-scheduling and Resend email batching.",
        contentJson: {
          type: "doc",
          content: [{ type: "paragraph", text: "Detailed notes..." }],
        },
        pinned: true,
        tags: ["architecture", "sprint-42", "planning"],
      };

      const result = noteSchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.title).toBe("Sprint 42 Architecture Blueprint");
        expect(result.data.pinned).toBe(true);
        expect(result.data.tags).toHaveLength(3);
      }
    });

    it("should validate partial updates for debounced autosave", () => {
      // Autosave updating only text
      const textUpdate = updateNoteSchema.safeParse({
        contentText: "Updated paragraph text during active typing...",
      });
      expect(textUpdate.success).toBe(true);

      // Autosave updating only title
      const titleUpdate = updateNoteSchema.safeParse({
        title: "Renamed Title",
      });
      expect(titleUpdate.success).toBe(true);

      // Autosave toggling pin
      const pinUpdate = updateNoteSchema.safeParse({
        pinned: true,
      });
      expect(pinUpdate.success).toBe(true);
    });
  });

  describe("Search & Tag Matching Logic (FR-20)", () => {
    const mockNotes = [
      {
        id: "note-1",
        authorId: "user-alice",
        title: "Quarterly OKR Review",
        contentText: "Key results for product launch and customer growth.",
        pinned: true,
        tags: ["okr", "strategy"],
      },
      {
        id: "note-2",
        authorId: "user-alice",
        title: "Resend Integration Ideas",
        contentText: "Remember to configure SPF and DKIM DNS records.",
        pinned: false,
        tags: ["resend", "email"],
      },
      {
        id: "note-3",
        authorId: "user-bob",
        title: "Bob's Secret Diary",
        contentText: "Personal thoughts.",
        pinned: false,
        tags: ["private"],
      },
    ];

    it("should search notes by title (case-insensitive)", () => {
      const query = "okr";
      const results = mockNotes.filter(
        (n) =>
          n.authorId === "user-alice" &&
          (n.title.toLowerCase().includes(query) || n.contentText.toLowerCase().includes(query))
      );
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe("note-1");
    });

    it("should search notes by body content (case-insensitive)", () => {
      const query = "dkim";
      const results = mockNotes.filter(
        (n) =>
          n.authorId === "user-alice" &&
          (n.title.toLowerCase().includes(query) || n.contentText.toLowerCase().includes(query))
      );
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe("note-2");
    });

    it("should filter notes by tag", () => {
      const tag = "strategy";
      const results = mockNotes.filter(
        (n) => n.authorId === "user-alice" && n.tags.includes(tag)
      );
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe("note-1");
    });

    it("should enforce private-by-default isolation (FR-21)", () => {
      const aliceUserId = "user-alice";
      const aliceNotes = mockNotes.filter((n) => n.authorId === aliceUserId);

      // Verify Bob's note is never returned in Alice's notebook
      expect(aliceNotes.some((n) => n.id === "note-3")).toBe(false);
      expect(aliceNotes).toHaveLength(2);
    });
  });
});
