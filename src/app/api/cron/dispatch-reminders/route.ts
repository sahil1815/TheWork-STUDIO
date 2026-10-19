import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  getDailyEmailUsage,
  sendEmail,
  renderReminderDigestHtml,
} from "@/lib/email";
import { ReminderJobStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

/**
 * Endpoint for Scheduled Reminder Job Dispatcher (FR-24, FR-26, FR-27, Section 2.3)
 * Triggered by Vercel Cron, GitHub Actions, or cron-job.org
 */
export async function GET(req: NextRequest) {
  return handleDispatch(req);
}

export async function POST(req: NextRequest) {
  return handleDispatch(req);
}

async function handleDispatch(req: NextRequest) {
  // 1. Authorize CRON_SECRET if configured
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = req.headers.get("authorization");
    const querySecret = req.nextUrl.searchParams.get("secret");

    const isHeaderValid = authHeader === `Bearer ${cronSecret}`;
    const isQueryValid = querySecret === cronSecret;

    if (!isHeaderValid && !isQueryValid) {
      return NextResponse.json(
        { error: "Unauthorized. Invalid CRON_SECRET." },
        { status: 401 }
      );
    }
  }

  try {
    // 2. Check Daily Email Quota (FR-26)
    const usage = await getDailyEmailUsage();
    if (!usage.canSend) {
      return NextResponse.json({
        status: "QUOTA_EXHAUSTED",
        message: "Daily email budget limit reached (100 emails/day). Dispatch deferred.",
        sentToday: usage.sentToday,
        dailyLimit: usage.dailyLimit,
        processed: 0,
      });
    }

    const batchLimit = Math.min(50, usage.remainingQuota);

    // 3. Concurrency Protection: PostgreSQL FOR UPDATE SKIP LOCKED
    let dueJobIds: string[] = [];
    try {
      const lockedRows = await db.$queryRaw<{ id: string }[]>`
        SELECT id FROM reminder_jobs
        WHERE status = 'PENDING' AND send_at <= NOW()
        ORDER BY send_at ASC
        LIMIT ${batchLimit}
        FOR UPDATE SKIP LOCKED
      `;
      dueJobIds = lockedRows.map((r) => r.id);
    } catch {
      // Fallback for non-Postgres environments or unit tests
      const fallbackRows = await db.reminderJob.findMany({
        where: {
          status: ReminderJobStatus.PENDING,
          sendAt: { lte: new Date() },
        },
        select: { id: true },
        take: batchLimit,
        orderBy: { sendAt: "asc" },
      });
      dueJobIds = fallbackRows.map((r) => r.id);
    }

    if (dueJobIds.length === 0) {
      return NextResponse.json({
        status: "IDLE",
        message: "No pending reminder jobs due at this time.",
        processedJobs: 0,
        emailsSent: 0,
        quotaRemaining: usage.remainingQuota,
      });
    }

    // 4. Fetch full job and task details
    const jobs = await db.reminderJob.findMany({
      where: { id: { in: dueJobIds } },
      include: {
        user: { select: { id: true, name: true, email: true } },
        task: {
          select: {
            id: true,
            title: true,
            date: true,
            startTime: true,
            endTime: true,
            priority: true,
            location: true,
            team: { select: { name: true } },
          },
        },
      },
    });

    // 5. Group jobs by User for Digest Batching (FR-27)
    const userJobsMap = new Map<string, typeof jobs>();
    for (const job of jobs) {
      if (!job.user?.email) continue;
      const list = userJobsMap.get(job.userId) || [];
      list.push(job);
      userJobsMap.set(job.userId, list);
    }

    const appUrl =
      process.env.NEXTAUTH_URL ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

    let emailsSent = 0;
    let failedCount = 0;

    // 6. Dispatch digest per user
    for (const [userId, userJobs] of userJobsMap.entries()) {
      const user = userJobs[0].user;
      const jobIds = userJobs.map((j) => j.id);

      const uniqueTasksMap = new Map<string, (typeof userJobs)[0]["task"]>();
      for (const j of userJobs) {
        if (!uniqueTasksMap.has(j.task.id)) {
          uniqueTasksMap.set(j.task.id, j.task);
        }
      }
      const uniqueTasks = Array.from(uniqueTasksMap.values());

      const subject =
        uniqueTasks.length > 1
          ? `[TheWork STUDIO] Reminder: You have ${uniqueTasks.length} tasks scheduled`
          : `[TheWork STUDIO] Reminder: ${uniqueTasks[0].title}`;

      const html = renderReminderDigestHtml({
        userName: user.name || user.email,
        tasks: uniqueTasks.map((t) => ({
          ...t,
          teamName: t.team?.name || null,
        })),
        appUrl,
      });

      const sendResult = await sendEmail({
        to: user.email,
        subject,
        html,
      });

      if (sendResult.success) {
        emailsSent++;
        // Update all bundled jobs to SENT
        await db.reminderJob.updateMany({
          where: { id: { in: jobIds } },
          data: {
            status: ReminderJobStatus.SENT,
            sentAt: new Date(),
            providerMessageId: sendResult.id,
            error: null,
          },
        });
      } else {
        failedCount++;
        // Increment attempts and update status on failure
        for (const job of userJobs) {
          const nextAttempts = job.attempts + 1;
          await db.reminderJob.update({
            where: { id: job.id },
            data: {
              attempts: nextAttempts,
              error: sendResult.error || "Failed to dispatch email",
              status:
                nextAttempts >= 3
                  ? ReminderJobStatus.FAILED
                  : ReminderJobStatus.PENDING,
            },
          });
        }
      }
    }

    return NextResponse.json({
      status: "SUCCESS",
      processedJobs: jobs.length,
      emailsSent,
      failedCount,
      quotaRemaining: Math.max(0, usage.remainingQuota - emailsSent),
    });
  } catch (error: unknown) {
    console.error("Cron dispatch execution failed:", error);
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
