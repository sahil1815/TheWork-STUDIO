"use client";

import { useState, useRef, useEffect } from "react";
import { Check, ChevronDown, User, UserCheck, Users, X, Search } from "lucide-react";

export interface TeamMemberOption {
  id: string;
  name: string | null;
  email: string;
  role?: string;
}

interface AssigneeMultiSelectProps {
  members: TeamMemberOption[];
  selectedMemberIds: string[];
  onChange: (memberIds: string[]) => void;
  currentUserId?: string;
  label?: string;
  placeholder?: string;
  compact?: boolean;
  disabled?: boolean;
  loading?: boolean;
}

export function AssigneeMultiSelect({
  members,
  selectedMemberIds,
  onChange,
  currentUserId,
  label,
  placeholder = "Select team members...",
  compact = false,
  disabled = false,
  loading = false,
}: AssigneeMultiSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen && members.length > 3) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    } else {
      setSearch("");
    }
  }, [isOpen, members.length]);

  const selectedMembers = members.filter((m) => selectedMemberIds.includes(m.id));

  // Also include any selected IDs that might not be in the current team members list (fallback)
  const unknownSelectedCount = selectedMemberIds.filter(
    (id) => !members.some((m) => m.id === id)
  ).length;

  const filteredMembers = members.filter((m) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    const matchName = m.name?.toLowerCase().includes(q);
    const matchEmail = m.email.toLowerCase().includes(q);
    return matchName || matchEmail;
  });

  const toggleMember = (memberId: string) => {
    if (disabled) return;
    if (selectedMemberIds.includes(memberId)) {
      onChange(selectedMemberIds.filter((id) => id !== memberId));
    } else {
      onChange([...selectedMemberIds, memberId]);
    }
  };

  const removeMember = (memberId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (disabled) return;
    onChange(selectedMemberIds.filter((id) => id !== memberId));
  };

  const handleSelectAll = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (disabled) return;
    onChange(members.map((m) => m.id));
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (disabled) return;
    onChange([]);
  };

  const handleAssignToMe = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (disabled || !currentUserId) return;
    if (!selectedMemberIds.includes(currentUserId)) {
      onChange([...selectedMemberIds, currentUserId]);
    }
  };

  const getInitials = (name: string | null, email: string) => {
    if (name && name.trim()) {
      const parts = name.trim().split(/\s+/);
      if (parts.length >= 2) {
        return (parts[0][0] + parts[1][0]).toUpperCase();
      }
      return name.slice(0, 2).toUpperCase();
    }
    return email.slice(0, 2).toUpperCase();
  };

  return (
    <div ref={containerRef} className="relative w-full text-xs">
      {label && (
        <div className="flex items-center justify-between mb-1.5">
          <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400">
            {label}
          </label>
          {selectedMemberIds.length > 0 && (
            <span className="text-[10px] font-semibold text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/50 px-2 py-0.5 rounded-full border border-purple-200/60 dark:border-purple-800/60">
              {selectedMemberIds.length} {selectedMemberIds.length === 1 ? "member" : "members"}
            </span>
          )}
        </div>
      )}

      {/* Main Trigger Box */}
      <div
        onClick={() => !disabled && !loading && setIsOpen((prev) => !prev)}
        className={`w-full rounded-lg border transition cursor-pointer ${
          disabled
            ? "opacity-60 cursor-not-allowed bg-zinc-100 dark:bg-zinc-800/50 border-zinc-200 dark:border-zinc-800"
            : isOpen
            ? "border-purple-500 ring-2 ring-purple-500/20 bg-white dark:bg-zinc-900"
            : "border-zinc-300 dark:border-zinc-700 hover:border-zinc-400 dark:hover:border-zinc-600 bg-white dark:bg-zinc-800/80"
        } ${compact ? "p-1.5" : "p-2"} shadow-2xs`}
      >
        <div className="flex items-center justify-between gap-2">
          {/* Selected Chips or Placeholder */}
          <div className="flex-1 min-w-0">
            {loading ? (
              <span className="text-zinc-400 italic">Loading team members...</span>
            ) : selectedMembers.length === 0 && unknownSelectedCount === 0 ? (
              <div className="flex items-center gap-1.5 text-zinc-400 dark:text-zinc-500">
                <Users className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{placeholder}</span>
              </div>
            ) : (
              <div className="flex flex-wrap gap-1.5 items-center">
                {selectedMembers.map((member) => {
                  const isSelf = member.id === currentUserId;
                  return (
                    <span
                      key={member.id}
                      className="inline-flex items-center gap-1 pl-1.5 pr-1 py-0.5 rounded-md bg-purple-50 dark:bg-purple-950/60 border border-purple-200/80 dark:border-purple-800/80 text-purple-900 dark:text-purple-200 text-[11px] font-medium transition group"
                    >
                      <span className="w-4 h-4 rounded-full bg-purple-200 dark:bg-purple-800 text-purple-800 dark:text-purple-200 text-[9px] font-bold flex items-center justify-center shrink-0">
                        {getInitials(member.name, member.email)}
                      </span>
                      <span className="truncate max-w-[110px]">
                        {member.name || member.email}
                      </span>
                      {isSelf && (
                        <span className="text-[9px] font-bold text-purple-600 dark:text-purple-400">
                          (You)
                        </span>
                      )}
                      {!disabled && (
                        <button
                          type="button"
                          onClick={(e) => removeMember(member.id, e)}
                          className="hover:bg-purple-200 dark:hover:bg-purple-800 rounded p-0.5 text-purple-500 hover:text-purple-900 dark:hover:text-purple-100 transition"
                          title={`Remove ${member.name || member.email}`}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      )}
                    </span>
                  );
                })}

                {unknownSelectedCount > 0 && (
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700">
                    +{unknownSelectedCount} assigned
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Right Action / Toggle */}
          <div className="flex items-center gap-1 shrink-0 text-zinc-400">
            {currentUserId &&
              !selectedMemberIds.includes(currentUserId) &&
              members.some((m) => m.id === currentUserId) && (
                <button
                  type="button"
                  onClick={handleAssignToMe}
                  className="hidden sm:inline-flex items-center gap-1 text-[10px] font-semibold text-purple-700 dark:text-purple-300 hover:text-purple-800 dark:hover:text-purple-200 bg-purple-50 hover:bg-purple-100 dark:bg-purple-950/40 dark:hover:bg-purple-900/60 px-1.5 py-0.5 rounded border border-purple-200 dark:border-purple-800 transition"
                  title="Quickly assign this task to yourself"
                >
                  <UserCheck className="h-2.5 w-2.5" />
                  <span>+ Me</span>
                </button>
              )}

            <ChevronDown
              className={`h-4 w-4 transition-transform duration-200 ${
                isOpen ? "rotate-180 text-purple-600" : ""
              }`}
            />
          </div>
        </div>
      </div>

      {/* Dropdown Panel */}
      {isOpen && (
        <div className="absolute left-0 right-0 mt-1.5 z-40 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150">
          {/* Quick Filter & Search Bar */}
          <div className="p-2 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900/70 space-y-2">
            {members.length > 3 && (
              <div className="relative">
                <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-zinc-400" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search members..."
                  className="w-full rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-800 pl-8 pr-2.5 py-1 text-xs text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-purple-500"
                />
              </div>
            )}

            {/* Quick Action Buttons */}
            <div className="flex items-center justify-between text-[11px] pt-0.5">
              <span className="text-zinc-500 font-medium">
                {selectedMemberIds.length} of {members.length} selected
              </span>
              <div className="flex items-center gap-2 font-semibold">
                {currentUserId && members.some((m) => m.id === currentUserId) && (
                  <button
                    type="button"
                    onClick={handleAssignToMe}
                    className="text-purple-600 dark:text-purple-400 hover:underline"
                  >
                    + Assign Me
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleSelectAll}
                  className="text-blue-600 dark:text-blue-400 hover:underline"
                >
                  Select All
                </button>
                {selectedMemberIds.length > 0 && (
                  <button
                    type="button"
                    onClick={handleClear}
                    className="text-zinc-500 hover:text-red-600 hover:underline"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Members List */}
          <div className="max-h-56 overflow-y-auto divide-y divide-zinc-100 dark:divide-zinc-800/60 p-1">
            {filteredMembers.length === 0 ? (
              <div className="p-4 text-center text-zinc-500 text-xs">
                {search ? "No members match your search" : "No team members found"}
              </div>
            ) : (
              filteredMembers.map((member) => {
                const isSelected = selectedMemberIds.includes(member.id);
                const isSelf = member.id === currentUserId;

                return (
                  <div
                    key={member.id}
                    onClick={() => toggleMember(member.id)}
                    className={`flex items-center justify-between gap-2.5 px-2.5 py-2 rounded-lg cursor-pointer transition select-none ${
                      isSelected
                        ? "bg-purple-50 dark:bg-purple-950/40 text-purple-950 dark:text-purple-100"
                        : "hover:bg-zinc-50 dark:hover:bg-zinc-800/60 text-zinc-800 dark:text-zinc-200"
                    }`}
                  >
                    {/* Left: Checkbox + Avatar + Info */}
                    <div className="flex items-center gap-2.5 min-w-0">
                      {/* Checkbox */}
                      <div
                        className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition ${
                          isSelected
                            ? "bg-purple-600 border-purple-600 text-white"
                            : "border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800"
                        }`}
                      >
                        {isSelected && <Check className="h-3 w-3 stroke-[3]" />}
                      </div>

                      {/* Avatar */}
                      <div className="w-6 h-6 rounded-full bg-zinc-200 dark:bg-zinc-700 text-zinc-800 dark:text-zinc-200 font-bold text-[10px] flex items-center justify-center shrink-0">
                        {getInitials(member.name, member.email)}
                      </div>

                      {/* Name & Email */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-xs truncate">
                            {member.name || member.email}
                          </span>
                          {isSelf && (
                            <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-purple-100 dark:bg-purple-900/70 text-purple-700 dark:text-purple-300">
                              You
                            </span>
                          )}
                        </div>
                        {member.name && (
                          <span className="block text-[10px] text-zinc-400 truncate">
                            {member.email}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Right: Role Badge */}
                    {member.role && (
                      <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 shrink-0">
                        {member.role.toLowerCase()}
                      </span>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
