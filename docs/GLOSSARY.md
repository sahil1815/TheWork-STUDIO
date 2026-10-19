# Team Planner — Official Glossary & Naming Reference

This document serves as the single source of truth for all domain concepts, UI labels, database tables, TypeScript types, routes, and naming conventions throughout the Team Planner application.

## 1. Domain Entities & Naming Matrix

| Concept | UI Label | Code Model / DB Table | Route | Description |
|---|---|---|---|---|
| A scheduled item for a person or team | **Task** | `Task` / `tasks` | `/tasks`, `/calendar` | A single action item with a required date and optional start/end times. |
| Calendar view of accepted tasks | **Calendar** | `calendar` | `/calendar` | Interactive view (month, week, day, agenda) displaying personal and accepted team tasks. |
| Group of collaborating people | **Team** | `Team` / `teams` | `/teams/[teamId]` | A collaboration boundary containing tasks, notes, members, and proposals. |
| Membership of a person in a team | **Member** | `TeamMember` / `team_members` | `/teams/[teamId]/members` | Associates a user with a team and assigns their active role. |
| Team creator with full administrative authority | **Master Admin** | role `OWNER` | — | Sole owner of the team. Full governance, invitations, role assignments, removals, and transfer. |
| Team manager | **Admin** | role `ADMIN` | — | Can create team tasks, send invitations (subject to Master Admin approval), and propose tasks. |
| Standard team collaborator | **Member** | role `MEMBER` | — | Can create tasks for self, propose tasks to peers, accept/decline proposals, and view team items. |
| Read-only collaborator | **Guest** | role `GUEST` | — | Read-only view of team calendar, team tasks, and notes explicitly shared with them. |
| Team join request/invite | **Invitation** | `TeamInvitation` / `team_invitations` | `/teams/[teamId]/invitations` | Two-step invitation flow: Admin invites -> Master Admin approves -> Invitee accepts. |
| Work offered by one member to another | **Task Proposal** | `TaskProposal` / `task_proposals` | `/inbox` | Peer-to-peer work proposal requiring explicit acceptance before appearing on a calendar. |
| Free-form rich text entry | **Note** | `Note` / `notes` | `/notebook` | User note with JSON & plain-text representations, tags, and pinning. Private by default. |
| Explicit note access grant | **Note Share** | `NoteShare` / `note_shares` | — | Shares a note with an individual user or an entire team with `VIEW` or `EDIT` permissions. |
| Per-user reminder configuration | **Reminder Settings** | `ReminderPreference` / `reminder_preferences` | `/settings/reminders` | User's global reminder defaults (3 days, 1 day, 00:00 day-of) and toggle status. |
| Individual scheduled email job | **Reminder Job** | `ReminderJob` / `reminder_jobs` | — | Scheduled background reminder entity computed in UTC for dispatch. |
| In-app notification and proposal hub | **Inbox** | `Notification` / `notifications` | `/inbox` | In-app notification center for pending proposals, approvals, and team invitations. |

---

## 2. Naming Conventions

- **TypeScript Variables & Functions**: `camelCase` (e.g., `calculateSendAt`, `defaultOffsets`, `invitationToken`)
- **TypeScript Types, Interfaces & Components**: `PascalCase` (e.g., `TeamMember`, `TaskProposal`, `CalendarView`)
- **Files & Folders**: `kebab-case` (e.g., `task-card.tsx`, `calendar-grid.tsx`, `dispatch-reminders/route.ts`)
- **Database Tables & Columns**: `snake_case` plural for tables (`team_members`, `reminder_jobs`), `snake_case` for columns (`start_time`, `user_id`, `token_hash`)
- **Enum Types & Values**: `PascalCase` for enum names (`Role`, `TaskStatus`), `SCREAMING_SNAKE_CASE` for values (`OWNER`, `PENDING_APPROVAL`, `IN_PROGRESS`)

---

## 3. Role Hierarchy & Permission Scope

| Role | UI Display | Permissions |
|---|---|---|
| `OWNER` | **Master Admin** | Total control over team lifecycle, transfer ownership, approve invitations, assign roles, manage any task. Exactly one per team. |
| `ADMIN` | **Admin** | Create team tasks, edit any team task, invite new members (queued for approval), propose tasks. |
| `MEMBER` | **Member** | Create team tasks for self, edit own team tasks, propose tasks to peers, accept/decline proposals. |
| `GUEST` | **Guest** | Read-only view of team calendar, team tasks, and notes explicitly shared with them. Cannot create tasks or send/receive proposals. |
