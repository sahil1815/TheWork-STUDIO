# Team Planner 📅

> **Full-Stack Team Scheduling, Collaboration, and Notebook Web Application**  
> Built with Next.js 16 (App Router), TypeScript, Tailwind CSS, Prisma ORM, PostgreSQL (Neon), NextAuth v5, and Resend.  
> **100% Free-Tier Architecture ($0 / month operating cost).**

---

## 🌟 Highlights & Capabilities

- **Personal & Team Calendar (FR-01 to FR-09)**:
  - Interactive **Month**, **Week**, **Day**, and **Agenda** views with HTML5 drag-and-drop rescheduling.
  - Granular calendar filtering (`All Calendars`, `Personal Tasks Only`, or specific `Team Calendars`).
  - Strict timing validation (FR-05): all-day, timed start-only, and time ranges (`endTime > startTime`), with automatic rejection of `endTime` without `startTime`.
  - Color-coded priority badges (`LOW`, `MEDIUM`, `HIGH`) and locations.
- **Multi-Role Team Management (FR-10 to FR-16)**:
  - 4 distinct roles: `OWNER` (Master Admin), `ADMIN`, `MEMBER`, and `GUEST`.
  - Single source of truth permission engine (`src/lib/permissions.ts`).
  - **Two-Step Invitation Approval Workflow**: Admins propose invitations $\to$ Master Admin approves/dispatches single-use cryptographic join links $\to$ Invitee accepts.
  - Atomic ownership transfer and team roster administration.
- **Peer-to-Peer Task Proposals & Unified Inbox (FR-17 to FR-19, FR-28)**:
  - Propose scheduled tasks with start/end times and personal notes directly to teammates.
  - 4-tab central **Inbox**: Pending Received Proposals, Sent Proposals tracking (with 1-click cancel), Approved Invitations, and In-App Notifications feed.
  - 1-click **Accept** atomically creates a linked task on the recipient's personal and team calendar.
  - Strict role guardrail (FR-19): Guests cannot propose or receive task proposals.
- **Private & Shared Notebook (FR-20 to FR-23)**:
  - Private by default with debounced autosave (`700ms`), pin-to-top, and tagging.
  - Markdown formatting shortcuts (bold, italic, headings, bullet lists, numbered lists, blockquotes, inline code).
  - Share notes with individual teammates or entire teams with granular `VIEW` (read-only) or `EDIT` permissions.
  - Critical Guest rule (FR-22): Team Guests are strictly restricted to `VIEW` permission even if the team was granted `EDIT`.
  - "Shared with Me" sidebar grouping with live author attribution.
- **Automated Email Reminders & Dispatcher (FR-24 to FR-27)**:
  - Automatic UTC timestamp calculations respecting each recipient's active IANA timezone (`Intl.DateTimeFormat` + `date-fns-tz`).
  - Default offsets: **3 days before** (4,320 min), **1 day before** (1,440 min), and **day of task at start time / 00:00** (0 min).
  - User-configurable reminder preferences and per-task overrides.
  - **Resend Free Tier Protection**: Daily email quota guard (<100 emails/day) and multi-task **Digest Batching** that merges multiple reminders into a single email.
  - **PostgreSQL `FOR UPDATE SKIP LOCKED` Dispatcher**: `/api/cron/dispatch-reminders` endpoint immune to race conditions or duplicate sends.
  - Automated 10-minute triggers via `vercel.json` and free GitHub Actions workflow.

---

## 🛠️ Technology Stack ($0 Free Tier)

| Component | Technology | Free Tier Specification |
|---|---|---|
| **Framework** | Next.js 16 (App Router, React 19) | Open Source (MIT) |
| **Language** | TypeScript (Strict Mode) | Open Source |
| **Database** | PostgreSQL on **Neon** | 0.5 GB storage, free compute with scale-to-zero (no 7-day inactivity pausing) |
| **ORM** | Prisma ORM 6.4 | Clean schema migrations & type-safe queries |
| **Authentication** | NextAuth v5 (Auth.js) | Credentials (`bcryptjs`) + Google OAuth + IANA timezone auto-sync |
| **Styling** | Tailwind CSS + Lucide Icons | Responsive mobile-first design with dark mode support |
| **Email Service** | Resend REST API | Free plan (3,000 emails/month, 100 emails/day max) |
| **Cron Trigger** | GitHub Actions / cron-job.org | 100% free automated 10-minute recurring execution ($0 tier) |
| **Testing** | Vitest | 93 passing unit & integration tests |

---

## 🚀 Quick Start / Local Setup

### 1. Prerequisites
- **Node.js** v18+ or v20+
- **npm** v9+
- A free **PostgreSQL** database (e.g., [Neon](https://neon.tech) free tier, or local PostgreSQL)

### 2. Clone and Install Dependencies
```bash
git clone <repository-url>
cd the_work-studio
npm install
```

### 3. Environment Configuration
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Update your `.env` variables:
```env
# Database (Neon PostgreSQL connection string)
DATABASE_URL="postgresql://user:password@ep-xyz.us-east-2.aws.neon.tech/neondb?sslmode=require"

# NextAuth v5
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="generate-a-secure-32-byte-secret"

# Resend Email (Free tier: https://resend.com)
# Leave as mock_resend_key to use built-in email simulation mode in development
RESEND_API_KEY="mock_resend_key"
EMAIL_FROM="Team Planner <onboarding@resend.dev>"
DAILY_EMAIL_LIMIT="100"

# Cron Security Secret (for /api/cron/dispatch-reminders)
CRON_SECRET="your-secure-cron-secret"
```

### 4. Database Migration & Seed
Run Prisma migrations and populate the database with seed users, teams, tasks, and notes:
```bash
# Push database migrations
npx prisma migrate dev

# Seed test data (5 users, all 4 roles, tasks, proposals, and notes)
npm run prisma:seed
```

### 5. Start Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🧪 Testing & Code Quality

```bash
# Run all 93 unit and integration tests (Vitest)
npm test

# Run TypeScript type check (strict, zero errors)
npx tsc --noEmit

# Compile production build
npm run build
```

---

## 👥 Seed Credentials (Pre-configured)

| Name | Email | Password | Seed Role |
|---|---|---|---|
| **Alice Smith** | `alice@example.com` | `password123` | Master Admin (`OWNER`) |
| **Bob Jones** | `bob@example.com` | `password123` | Admin (`ADMIN`) |
| **Charlie Brown** | `charlie@example.com` | `password123` | Member (`MEMBER`) |
| **Diana Prince** | `diana@example.com` | `password123` | Member (`MEMBER`) |
| **Evan Wright** | `evan@example.com` | `password123` | Guest (`GUEST`) |

---

## ⏰ Cron & Automated Reminders Setup

The reminder dispatcher is located at `/api/cron/dispatch-reminders`. Since Vercel Hobby accounts restrict built-in Vercel Cron to once per day, use one of the following 100% free external triggers to run every 10 minutes:

1. **GitHub Actions (Recommended - 100% Free)**:  
   Configured in `.github/workflows/cron.yml` to trigger every 10 minutes (`*/10 * * * *`). Simply add two repository secrets in GitHub (**Settings** $\to$ **Secrets and variables** $\to$ **Actions**):
   - `APP_URL`: Your Vercel domain (e.g., `https://the-work-studio.vercel.app`)
   - `CRON_SECRET`: Your secure secret token matching `CRON_SECRET` on Vercel.

2. **Free External Cron Service (e.g. cron-job.org)**:  
   Create a free job at [cron-job.org](https://cron-job.org) targeting:  
   `POST https://<your-vercel-domain>/api/cron/dispatch-reminders` with header `Authorization: Bearer <CRON_SECRET>` scheduled for every 10 minutes.

3. **Manual Trigger (curl)**:
   ```bash
   curl -X POST "http://localhost:3000/api/cron/dispatch-reminders" \
     -H "Authorization: Bearer your-secure-cron-secret"
   ```

---

## 📖 Documentation Directory

- [GLOSSARY.md](docs/GLOSSARY.md): Comprehensive naming dictionary across DB, code, and routes.
- [ARCHITECTURE.md](docs/ARCHITECTURE.md): System architecture, sequence diagrams, and free-tier guardrails.
- [DEPLOYMENT.md](docs/DEPLOYMENT.md): Step-by-step production deployment guide for Vercel, Neon, and Resend.

---

## 📄 License
MIT License. Free to use, modify, and deploy.
