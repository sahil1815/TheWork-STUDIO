"use client";

import { useState } from "react";
import { NoteSidebar } from "./note-sidebar";
import { NoteEditor } from "./note-editor";
import { createNote, getNotes, getAllUserTags } from "@/actions/note-actions";
import { ChevronLeft } from "lucide-react";

interface NotebookRootProps {
  initialNotes: any[];
  initialTags: string[];
}

export function NotebookRoot({ initialNotes, initialTags }: NotebookRootProps) {
  const [notes, setNotes] = useState<any[]>(initialNotes);
  const [availableTags, setAvailableTags] = useState<string[]>(initialTags);
  const [activeNoteId, setActiveNoteId] = useState<string | null>(
    initialNotes.length > 0 ? initialNotes[0].id : null
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [isMobileEditorOpen, setIsMobileEditorOpen] = useState(false);

  // Active note object
  const activeNote = notes.find((n) => n.id === activeNoteId) || null;

  const refreshNotes = async (search?: string, tag?: string | null) => {
    const updated = await getNotes(
      search !== undefined ? search : searchQuery,
      tag !== undefined ? (tag || undefined) : (selectedTag || undefined)
    );
    setNotes(updated);

    const tags = await getAllUserTags();
    setAvailableTags(tags);
  };

  const handleSearchChange = async (query: string) => {
    setSearchQuery(query);
    await refreshNotes(query, selectedTag);
  };

  const handleTagChange = async (tag: string | null) => {
    setSelectedTag(tag);
    await refreshNotes(searchQuery, tag);
  };

  const handleCreateNote = async () => {
    const res = await createNote();
    if (res.success && res.note) {
      setNotes((prev) => [res.note, ...prev]);
      setActiveNoteId(res.note.id);
      setIsMobileEditorOpen(true);
    }
  };

  const handleSelectNote = (noteId: string) => {
    setActiveNoteId(noteId);
    setIsMobileEditorOpen(true);
  };

  const handleNoteUpdated = (updatedNote: any) => {
    setNotes((prev) =>
      prev.map((n) => (n.id === updatedNote.id ? updatedNote : n))
    );
  };

  const handleNoteDeleted = (deletedId: string) => {
    setNotes((prev) => {
      const remaining = prev.filter((n) => n.id !== deletedId);
      if (activeNoteId === deletedId) {
        setActiveNoteId(remaining.length > 0 ? remaining[0].id : null);
      }
      return remaining;
    });
    setIsMobileEditorOpen(false);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-8.5rem)]">
      {/* Mobile back navigation when viewing editor */}
      {isMobileEditorOpen && (
        <div className="md:hidden pb-2">
          <button
            onClick={() => setIsMobileEditorOpen(false)}
            className="flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700"
          >
            <ChevronLeft className="h-4 w-4" />
            <span>Back to Notes list</span>
          </button>
        </div>
      )}

      {/* Split-pane container */}
      <div className="flex-1 flex gap-4 min-h-0">
        {/* Sidebar: hidden on mobile if editor is active */}
        <div className={`w-full md:w-80 h-full ${isMobileEditorOpen ? "hidden md:flex" : "flex"}`}>
          <NoteSidebar
            notes={notes}
            activeNoteId={activeNoteId}
            onSelectNote={handleSelectNote}
            onCreateNote={handleCreateNote}
            availableTags={availableTags}
            selectedTag={selectedTag}
            onSelectTag={handleTagChange}
            searchQuery={searchQuery}
            onSearchChange={handleSearchChange}
          />
        </div>

        {/* Editor: hidden on mobile unless note is active */}
        <div className={`flex-1 h-full ${!isMobileEditorOpen ? "hidden md:flex" : "flex"}`}>
          {activeNote ? (
            <NoteEditor
              note={activeNote}
              onNoteUpdated={handleNoteUpdated}
              onNoteDeleted={handleNoteDeleted}
            />
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center border border-zinc-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-900 p-8 text-center text-zinc-400">
              <p className="text-sm font-medium">No note selected</p>
              <button
                onClick={handleCreateNote}
                className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 transition"
              >
                Create a Note
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
