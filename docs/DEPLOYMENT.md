# Production Deployment Runbook ($0 / Month)

This guide walks you through deploying **Team Planner** to production entirely within the **100% free tier** using **Vercel**, **Neon PostgreSQL**, and **Resend**.

---

## 1. Free PostgreSQL Database on Neon

1. Sign up for a free account at [Neon](https://neon.tech).
2. Create a new project (e.g., `team-planner`).
3. Neon provides 0.5 GB of free storage and compute with scale-to-zero. Unlike Supabase free tier, Neon **never pauses** your project after 7 days of inactivity.
4. From the Neon dashboard, copy your PostgreSQL connection string:
   ```text
   postgresql://user:password@ep-xyz.us-east-2.aws.neon.tech/neondb?sslmode=require
   ```

---

## 2. Free Resend API Account

1. Sign up at [Resend](https://resend.com) (Free plan provides 3,000 emails/month and up to 100 emails/day).
2. Generate an API Key under **API Keys** (`re_...`).
3. If you have a custom domain, add and verify your DNS records under **Domains**.
4. If you don't have a custom domain yet, you can send test emails to your registered account email using `onboarding@resend.dev` as the `EMAIL_FROM`.
5. Set `DAILY_EMAIL_LIMIT="100"` in your environment variables to ensure the daily budgeter guards against exceeding free tier allowances.

---

## 3. Deploy to Vercel

1. Push your repository to GitHub or GitLab.
2. Sign in to [Vercel](https://vercel.com) and click **Add New Project** $\to$ **Import Git Repository**.
3. Configure Environment Variables in the Vercel dashboard:

| Variable | Description | Example Value |
|---|---|---|
| `DATABASE_URL` | Neon PostgreSQL pooled connection string | `postgresql://user:pass@ep-...neon.tech/neondb?sslmode=require` |
| `NEXTAUTH_URL` | Full canonical URL of your deployed application | `https://your-app.vercel.app` |
| `NEXTAUTH_SECRET` | 32-byte secure random string | `openssl rand -base64 32` |
| `RESEND_API_KEY` | Resend API key | `re_123456789...` |
| `EMAIL_FROM` | Verified sender email address | `Team Planner <reminders@yourdomain.com>` or `Team Planner <onboarding@resend.dev>` |
| `DAILY_EMAIL_LIMIT` | Maximum emails to dispatch per UTC day | `100` |
| `CRON_SECRET` | Secret token protecting the cron dispatcher route | `openssl rand -hex 24` |

4. Under **Build & Development Settings**:
   - Build Command: `npm run build`
   - Output Directory: `.next`
5. Click **Deploy**.

---

## 4. Run Production Migrations

Once your Vercel deployment completes, run the initial database schema migration against your Neon database from your local machine:

```bash
# Export your Neon connection string locally
export DATABASE_URL="postgresql://user:pass@ep-...neon.tech/neondb?sslmode=require"

# Apply migrations
npx prisma migrate deploy

# (Optional) Seed initial users and teams
npm run prisma:seed
```

---

## 5. Verify Automated Cron Dispatcher

Team Planner includes a `vercel.json` file that automatically registers a 10-minute cron job on Vercel:
```json
{
  "crons": [
    {
      "path": "/api/cron/dispatch-reminders",
      "schedule": "*/10 * * * *"
    }
  ]
}
```

- When triggered by Vercel, the route automatically processes due reminders.
- **Alternative Free Trigger (GitHub Actions)**:
  If running on a standard personal GitHub account, the included workflow `.github/workflows/cron-reminders.yml` runs every 10 minutes for free. Simply add `APP_URL` (e.g. `https://your-app.vercel.app`) and `CRON_SECRET` to your GitHub Repository Secrets.

- **Manual Verification**:
  ```bash
  curl -s -X POST "https://your-app.vercel.app/api/cron/dispatch-reminders" \
    -H "Authorization: Bearer <CRON_SECRET>"
  ```
  Expected response:
  ```json
  {
    "status": "SUCCESS" | "IDLE",
    "processedJobs": 0,
    "emailsSent": 0,
    "quotaRemaining": 100
  }
  ```

---

## 6. Security & Production Checklist

- [x] Passwords hashed using `bcryptjs` with salt rounds = 12.
- [x] Session tokens and invitation join tokens hashed with SHA-256 before storage.
- [x] Timing checks enforced both in Zod and via PostgreSQL database constraints.
- [x] Concurrency protection via PostgreSQL `FOR UPDATE SKIP LOCKED`.
- [x] Master Admin ownership swap protected by database transactions.
- [x] Daily email limit guarded to stay within $0 Resend free tier.
