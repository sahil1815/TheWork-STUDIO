"use client";

import { format } from "date-fns";
import { Search, Plus, Pin, BookOpen, Tag, Users, User, Lock } from "lucide-react";

interface NoteSidebarProps {
  notes: any[];
  activeNoteId: string | null;
  onSelectNote: (noteId: string) => void;
  onCreateNote: () => void;
  availableTags: string[];
  selectedTag: string | null;
  onSelectTag: (tag: string | null) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

export function NoteSidebar({
  notes,
  activeNoteId,
  onSelectNote,
  onCreateNote,
  availableTags,
  selectedTag,
  onSelectTag,
  searchQuery,
  onSearchChange,
}: NoteSidebarProps) {
  const pinnedNotes = notes.filter((n) => n.isOwner && n.pinned);
  const myNotes = notes.filter((n) => n.isOwner && !n.pinned);
  const sharedNotes = notes.filter((n) => !n.isOwner);

  return (
    <aside className="w-full md:w-80 flex flex-col h-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-sm shrink-0">
      {/* Sidebar Header */}
      <div className="p-4 border-b border-zinc-100 dark:border-zinc-800 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-blue-600" />
            <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
              Notebook
            </h2>
          </div>

          <button
            onClick={onCreateNote}
            className="flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-blue-700 transition"
            title="Create new note"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>New Note</span>
          </button>
        </div>

        {/* Search input (FR-20) */}
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-zinc-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search notes by title or body..."
            className="w-full rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/60 py-1.5 pl-8 pr-3 text-xs text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        {/* Tag pills filter */}
        {availableTags.length > 0 && (
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-1">
            <button
              onClick={() => onSelectTag(null)}
              className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium transition shrink-0 ${
                selectedTag === null
                  ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                  : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200"
              }`}
            >
              All
            </button>
            {availableTags.map((tag) => (
              <button
                key={tag}
                onClick={() => onSelectTag(selectedTag === tag ? null : tag)}
                className={`flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-medium transition shrink-0 ${
                  selectedTag === tag
                    ? "bg-blue-600 text-white"
                    : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200"
                }`}
              >
                <Tag className="h-2.5 w-2.5" />
                <span>#{tag}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Notes List */}
      <div className="flex-1 overflow-y-auto divide-y divide-zinc-100 dark:divide-zinc-800">
        {notes.length === 0 ? (
          <div className="p-8 text-center text-zinc-400 space-y-1">
            <p className="text-xs font-medium">No notes found</p>
            <p className="text-[11px] text-zinc-500">
              {searchQuery ? "Try a different search query" : "Click 'New Note' to start writing"}
            </p>
          </div>
        ) : (
          <>
            {/* 1. Pinned Section */}
            {pinnedNotes.length > 0 && (
              <div className="py-2">
                <div className="px-4 py-1 text-[11px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider flex items-center gap-1">
                  <Pin className="h-3 w-3 fill-amber-500" />
                  <span>Pinned</span>
                </div>
                {pinnedNotes.map((note) => (
                  <NoteItemCard
                    key={note.id}
                    note={note}
                    isActive={note.id === activeNoteId}
                    onSelect={() => onSelectNote(note.id)}
                  />
                ))}
              </div>
            )}

            {/* 2. My Notes Section */}
            <div className="py-2">
              <div className="px-4 py-1 text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
                My Notes ({myNotes.length})
              </div>
              {myNotes.length === 0 ? (
                <p className="px-4 py-2 text-xs text-zinc-400 italic">No notes</p>
              ) : (
                myNotes.map((note) => (
                  <NoteItemCard
                    key={note.id}
                    note={note}
                    isActive={note.id === activeNoteId}
                    onSelect={() => onSelectNote(note.id)}
                  />
                ))
              )}
            </div>

            {/* 3. Shared With Me Section (FR-23) */}
            {sharedNotes.length > 0 && (
              <div className="py-2 bg-zinc-50/50 dark:bg-zinc-950/20">
                <div className="px-4 py-1 text-[11px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Users className="h-3 w-3" />
                  <span>Shared with Me ({sharedNotes.length})</span>
                </div>
                {sharedNotes.map((note) => (
                  <NoteItemCard
                    key={note.id}
                    note={note}
                    isActive={note.id === activeNoteId}
                    onSelect={() => onSelectNote(note.id)}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </aside>
  );
}

function NoteItemCard({
  note,
  isActive,
  onSelect,
}: {
  note: any;
  isActive: boolean;
  onSelect: () => void;
}) {
  const preview = note.contentText?.trim() || "No content yet...";
  const isOwner = note.isOwner ?? true;

  return (
    <div
      onClick={onSelect}
      className={`px-4 py-3 cursor-pointer transition select-none ${
        isActive
          ? "bg-blue-50/80 dark:bg-blue-950/40 border-l-4 border-blue-600"
          : "hover:bg-zinc-50 dark:hover:bg-zinc-800/40 border-l-4 border-transparent"
      }`}
    >
      <div className="flex items-center justify-between gap-1 mb-1">
        <h3
          className={`text-sm font-semibold truncate ${
            isActive ? "text-blue-950 dark:text-blue-100" : "text-zinc-900 dark:text-zinc-100"
          }`}
        >
          {note.title || "Untitled Note"}
        </h3>
        <div className="flex items-center gap-1 shrink-0">
          {!isOwner && (
            <span
              className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${
                note.permission === "EDIT"
                  ? "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300"
                  : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
              }`}
            >
              {note.permission}
            </span>
          )}
          {isOwner && note.pinned && (
            <Pin className="h-3 w-3 fill-amber-500 text-amber-500" />
          )}
        </div>
      </div>

      <p className="text-xs text-zinc-500 line-clamp-2 leading-relaxed mb-1.5">
        {preview}
      </p>

      <div className="flex items-center justify-between text-[10px] text-zinc-400">
        <div className="flex items-center gap-1.5">
          <span>{note.updatedAt ? format(new Date(note.updatedAt), "MMM d") : ""}</span>
          {!isOwner && (
            <span className="text-zinc-500 truncate max-w-[100px]">
              · by {note.authorName}
            </span>
          )}
        </div>

        {note.tags && note.tags.length > 0 && (
          <div className="flex items-center gap-1">
            {note.tags.slice(0, 2).map((tag: string) => (
              <span key={tag} className="bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.2 rounded text-[10px]">
                #{tag}
              </span>
            ))}
            {note.tags.length > 2 && <span>+{note.tags.length - 2}</span>}
          </div>
        )}
      </div>
    </div>
  );
}
