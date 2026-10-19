"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { updateNote, togglePinNote, deleteNote } from "@/actions/note-actions";
import { NoteShareModal } from "./note-share-modal";
import { format } from "date-fns";
import {
  Pin,
  PinOff,
  Trash2,
  Check,
  Loader2,
  Tag as TagIcon,
  X,
  Bold,
  Italic,
  List,
  ListOrdered,
  Heading1,
  Heading2,
  Quote,
  Code,
  Share2,
  Lock,
  Users,
  User,
} from "lucide-react";

interface NoteEditorProps {
  note: any;
  onNoteUpdated: (updatedNote: any) => void;
  onNoteDeleted: (noteId: string) => void;
}

export function NoteEditor({ note, onNoteUpdated, onNoteDeleted }: NoteEditorProps) {
  const [title, setTitle] = useState(note?.title || "");
  const [content, setContent] = useState(note?.contentText || "");
  const [tags, setTags] = useState<string[]>(note?.tags || []);
  const [tagInput, setTagInput] = useState("");
  const [pinned, setPinned] = useState(note?.pinned || false);
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "unsaved" | "readonly">("saved");
  const [shareModalOpen, setShareModalOpen] = useState(false);

  const isOwner = note?.isOwner ?? true;
  const isReadOnly = note?.permission === "VIEW";
  const canEdit = isOwner || note?.permission === "EDIT";

  const saveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Sync state when note prop changes
  useEffect(() => {
    setTitle(note?.title || "");
    setContent(note?.contentText || "");
    setTags(note?.tags || []);
    setPinned(note?.pinned || false);
    setSaveStatus(isReadOnly ? "readonly" : "saved");
  }, [note?.id, isReadOnly]);

  // Debounced autosave
  const triggerAutosave = useCallback(
    (newTitle: string, newContent: string, newTags: string[], isPinned: boolean) => {
      if (!canEdit || isReadOnly) return;

      setSaveStatus("unsaved");

      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }

      saveTimerRef.current = setTimeout(async () => {
        setSaveStatus("saving");

        const jsonContent = {
          type: "doc",
          content: [
            {
              type: "paragraph",
              text: newContent,
            },
          ],
        };

        const res = await updateNote(note.id, {
          title: newTitle || "Untitled Note",
          contentText: newContent,
          contentJson: jsonContent,
          tags: newTags,
          pinned: isPinned,
        });

        if (res.success && res.note) {
          setSaveStatus("saved");
          onNoteUpdated(res.note);
        } else {
          setSaveStatus("unsaved");
        }
      }, 700);
    },
    [note?.id, onNoteUpdated, canEdit, isReadOnly]
  );

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isReadOnly) return;
    const val = e.target.value;
    setTitle(val);
    triggerAutosave(val, content, tags, pinned);
  };

  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (isReadOnly) return;
    const val = e.target.value;
    setContent(val);
    triggerAutosave(title, val, tags, pinned);
  };

  const handleTogglePin = async () => {
    if (!isOwner) return;
    const newPinned = !pinned;
    setPinned(newPinned);
    triggerAutosave(title, content, tags, newPinned);
    await togglePinNote(note.id);
  };

  const handleAddTag = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (isReadOnly) return;
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      const clean = tagInput.trim().replace(/^#/, "");
      if (clean && !tags.includes(clean)) {
        const nextTags = [...tags, clean];
        setTags(nextTags);
        setTagInput("");
        triggerAutosave(title, content, nextTags, pinned);
      }
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    if (isReadOnly) return;
    const nextTags = tags.filter((t) => t !== tagToRemove);
    setTags(nextTags);
    triggerAutosave(title, content, nextTags, pinned);
  };

  const handleDelete = async () => {
    if (!isOwner) return;
    const confirmed = window.confirm("Are you sure you want to delete this note?");
    if (!confirmed) return;

    const res = await deleteNote(note.id);
    if (res.success) {
      onNoteDeleted(note.id);
    }
  };

  const applyFormatting = (prefix: string, suffix: string = "") => {
    if (isReadOnly) return;
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = content.substring(start, end);
    const beforeText = content.substring(0, start);
    const afterText = content.substring(end);

    const replacement = `${prefix}${selectedText || "text"}${suffix}`;
    const nextContent = `${beforeText}${replacement}${afterText}`;
    setContent(nextContent);
    triggerAutosave(title, nextContent, tags, pinned);

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + prefix.length, start + prefix.length + (selectedText.length || 4));
    }, 10);
  };

  if (!note) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 text-center text-zinc-400">
        <p className="text-sm">Select a note from the sidebar or create a new one to begin writing.</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-sm">
      {/* Top Header Controls */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50">
        {/* Autosave / Access Status Indicator */}
        <div className="flex items-center gap-2 text-xs">
          {isReadOnly ? (
            <span className="flex items-center gap-1.5 text-zinc-500 font-medium bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded">
              <Lock className="h-3 w-3 text-zinc-400" />
              <span>Read-only View</span>
            </span>
          ) : saveStatus === "saving" ? (
            <span className="flex items-center gap-1.5 text-zinc-500 font-medium">
              <Loader2 className="h-3 w-3 animate-spin text-blue-600" />
              <span>Saving changes...</span>
            </span>
          ) : saveStatus === "saved" ? (
            <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-medium">
              <Check className="h-3.5 w-3.5" />
              <span>Autosaved</span>
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 font-medium">
              <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
              <span>Unsaved changes</span>
            </span>
          )}

          <span className="text-zinc-300 dark:text-zinc-700">|</span>
          <span className="text-zinc-400 text-[11px]">
            Updated {note.updatedAt ? format(new Date(note.updatedAt), "MMM d, h:mm a") : "just now"}
          </span>
        </div>

        {/* Action icons */}
        <div className="flex items-center gap-1.5">
          {/* Share Button (Author only FR-22) */}
          {isOwner && (
            <button
              onClick={() => setShareModalOpen(true)}
              className="flex items-center gap-1 rounded-lg border border-zinc-200 dark:border-zinc-700 px-2.5 py-1 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition shadow-xs"
              title="Share note with team or users"
            >
              <Share2 className="h-3.5 w-3.5 text-blue-600" />
              <span>Share</span>
            </button>
          )}

          {/* Pin Button (Author only) */}
          {isOwner && (
            <button
              onClick={handleTogglePin}
              className={`p-1.5 rounded-lg transition ${
                pinned
                  ? "bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300"
                  : "text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              }`}
              title={pinned ? "Unpin note" : "Pin note to top"}
            >
              {pinned ? <Pin className="h-4 w-4 fill-amber-500 text-amber-500" /> : <PinOff className="h-4 w-4" />}
            </button>
          )}

          {/* Delete Button (Author only FR-23) */}
          {isOwner && (
            <button
              onClick={handleDelete}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition"
              title="Delete note"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Shared Note Info Banner */}
      {!isOwner && (
        <div className="flex items-center justify-between px-6 py-2 bg-blue-50/80 dark:bg-blue-950/30 border-b border-blue-100 dark:border-blue-900/50 text-xs text-blue-900 dark:text-blue-200">
          <div className="flex items-center gap-2">
            {note.sharedVia === "TEAM" ? <Users className="h-3.5 w-3.5" /> : <User className="h-3.5 w-3.5" />}
            <span>
              Shared by <span className="font-semibold">{note.authorName}</span>
            </span>
          </div>
          <span className="font-semibold text-[11px] uppercase tracking-wider px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200">
            {note.permission === "EDIT" ? "Can Edit" : "View Only"}
          </span>
        </div>
      )}

      {/* Formatting Toolbar */}
      {!isReadOnly && (
        <div className="flex flex-wrap items-center gap-1 px-6 py-2 border-b border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 text-xs">
          <button
            type="button"
            onClick={() => applyFormatting("**", "**")}
            className="p-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800"
            title="Bold (**text**)"
          >
            <Bold className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => applyFormatting("*", "*")}
            className="p-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800"
            title="Italic (*text*)"
          >
            <Italic className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => applyFormatting("# ")}
            className="p-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 font-bold"
            title="Heading 1"
          >
            <Heading1 className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => applyFormatting("## ")}
            className="p-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 font-bold"
            title="Heading 2"
          >
            <Heading2 className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => applyFormatting("- ")}
            className="p-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800"
            title="Bullet List"
          >
            <List className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => applyFormatting("1. ")}
            className="p-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800"
            title="Numbered List"
          >
            <ListOrdered className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => applyFormatting("> ")}
            className="p-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800"
            title="Quote"
          >
            <Quote className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => applyFormatting("`", "`")}
            className="p-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800"
            title="Inline Code"
          >
            <Code className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Editor Content Area */}
      <div className="flex-1 flex flex-col p-6 space-y-4 overflow-y-auto">
        {/* Title Input */}
        <input
          type="text"
          value={title}
          readOnly={isReadOnly}
          onChange={handleTitleChange}
          placeholder="Untitled Note"
          className={`w-full text-2xl font-bold text-zinc-900 dark:text-zinc-50 bg-transparent placeholder-zinc-300 dark:placeholder-zinc-700 focus:outline-none ${
            isReadOnly ? "cursor-default" : ""
          }`}
        />

        {/* Tags Section */}
        <div className="flex flex-wrap items-center gap-1.5">
          <TagIcon className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
          {tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700"
            >
              <span>#{tag}</span>
              {!isReadOnly && (
                <button
                  type="button"
                  onClick={() => handleRemoveTag(tag)}
                  className="hover:text-red-500 transition"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </span>
          ))}
          {!isReadOnly && (
            <input
              type="text"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={handleAddTag}
              placeholder="Add tag (Enter)..."
              className="text-xs bg-transparent text-zinc-700 dark:text-zinc-300 placeholder-zinc-400 focus:outline-none py-0.5 px-1 min-w-[110px]"
            />
          )}
        </div>

        {/* Body Textarea */}
        <textarea
          ref={textareaRef}
          value={content}
          readOnly={isReadOnly}
          onChange={handleContentChange}
          placeholder={isReadOnly ? "Note content is empty." : "Write anything freely... (supports markdown, checklists, notes, thoughts)"}
          className={`flex-1 w-full bg-transparent resize-none text-sm text-zinc-800 dark:text-zinc-200 placeholder-zinc-400 focus:outline-none leading-relaxed font-sans min-h-[350px] ${
            isReadOnly ? "cursor-default" : ""
          }`}
        />
      </div>

      {/* Share Modal Dialog */}
      {isOwner && (
        <NoteShareModal
          noteId={note.id}
          noteTitle={title}
          isOpen={shareModalOpen}
          onClose={() => setShareModalOpen(false)}
        />
      )}
    </div>
  );
}
