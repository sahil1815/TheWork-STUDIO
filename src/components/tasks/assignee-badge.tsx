"use client";

import { User, Users } from "lucide-react";

export interface AssigneeInfo {
  id: string;
  name: string | null;
  email: string;
  image?: string | null;
}

interface AssigneeBadgeProps {
  assignees?: AssigneeInfo[];
  singleAssignee?: AssigneeInfo | null;
  maxDisplay?: number;
  showNames?: boolean;
  className?: string;
}

export function AssigneeBadge({
  assignees,
  singleAssignee,
  maxDisplay = 2,
  showNames = true,
  className = "",
}: AssigneeBadgeProps) {
  // Normalize assignees list: use assignees array if available, fallback to singleAssignee
  const list: AssigneeInfo[] =
    assignees && assignees.length > 0
      ? assignees
      : singleAssignee
      ? [singleAssignee]
      : [];

  if (list.length === 0) {
    return null;
  }

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

  const allNames = list.map((a) => a.name || a.email).join(", ");

  // Single Assignee presentation
  if (list.length === 1) {
    const member = list[0];
    return (
      <span
        className={`inline-flex items-center gap-1 font-medium text-zinc-600 dark:text-zinc-400 text-xs ${className}`}
        title={`Assigned to: ${allNames}`}
      >
        <User className="h-3 w-3 text-zinc-400 shrink-0" />
        <span className="truncate max-w-[150px]">{member.name || member.email}</span>
      </span>
    );
  }

  // Multiple Assignees presentation
  const visible = list.slice(0, maxDisplay);
  const remainingCount = list.length - maxDisplay;

  return (
    <div
      className={`inline-flex items-center gap-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-300 ${className}`}
      title={`Assigned to (${list.length}): ${allNames}`}
    >
      {/* Avatar Stack */}
      <div className="flex -space-x-1.5 overflow-hidden py-0.5 items-center">
        {visible.map((member) => (
          <span
            key={member.id}
            className="inline-flex h-4.5 w-4.5 rounded-full ring-2 ring-white dark:ring-zinc-900 bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 font-bold text-[9px] items-center justify-center shrink-0"
            title={member.name || member.email}
          >
            {getInitials(member.name, member.email)}
          </span>
        ))}
        {remainingCount > 0 && (
          <span className="inline-flex h-4.5 w-4.5 rounded-full ring-2 ring-white dark:ring-zinc-900 bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-bold text-[8px] items-center justify-center shrink-0">
            +{remainingCount}
          </span>
        )}
      </div>

      {/* Label / Names summary */}
      {showNames && (
        <span className="text-zinc-600 dark:text-zinc-400 text-[11px] truncate max-w-[140px] sm:max-w-[200px]">
          {visible.map((m) => m.name || m.email.split("@")[0]).join(", ")}
          {remainingCount > 0 && ` +${remainingCount}`}
        </span>
      )}
    </div>
  );
}
