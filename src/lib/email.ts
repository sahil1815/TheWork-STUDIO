import { db } from "@/lib/db";
import { formatTaskTiming, toDateString } from "@/lib/date-utils";
import { ReminderJobStatus, TaskPriority } from "@prisma/client";

export interface SendEmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
}

export interface EmailResult {
  success: boolean;
  id?: string;
  error?: string;
}

/**
 * Returns current daily email quota metrics (FR-26: Resend 100/day limit guard)
 */
export async function getDailyEmailUsage() {
  const dailyLimit = parseInt(process.env.DAILY_EMAIL_LIMIT || "100", 10);

  const todayUtcStart = new Date();
  todayUtcStart.setUTCHours(0, 0, 0, 0);

  try {
    const sentToday = await db.reminderJob.count({
      where: {
        status: ReminderJobStatus.SENT,
        sentAt: { gte: todayUtcStart },
      },
    });

    const remainingQuota = Math.max(0, dailyLimit - sentToday);
    return {
      sentToday,
      dailyLimit,
      remainingQuota,
      canSend: remainingQuota > 0,
    };
  } catch (error) {
    console.error("Failed to query daily email usage:", error);
    return {
      sentToday: 0,
      dailyLimit,
      remainingQuota: dailyLimit,
      canSend: true,
    };
  }
}

/**
 * Send email via Resend REST API with simulation fallback for local development (FR-26)
 */
export async function sendEmail({
  to,
  subject,
  html,
  text,
}: SendEmailOptions): Promise<EmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.EMAIL_FROM || "Team Planner <onboarding@resend.dev>";
  const toList = Array.isArray(to) ? to : [to];

  // If no API key or dummy key provided in development, simulate safely
  if (!apiKey || apiKey.startsWith("mock_") || apiKey === "re_test_dummy") {
    console.log(`[EMAIL SIMULATION - Resend] To: ${toList.join(", ")} | Subject: "${subject}"`);
    return {
      success: true,
      id: `sim_${Date.now()}_${Math.random().toString(36).substring(7)}`,
    };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromEmail,
        to: toList,
        subject,
        html,
        text,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      console.error("Resend API error:", data);
      return {
        success: false,
        error: data.message || "Failed to dispatch email via Resend",
      };
    }

    return {
      success: true,
      id: data.id,
    };
  } catch (error: unknown) {
    console.error("Network error calling Resend API:", error);
    const message = error instanceof Error ? error.message : "Network error";
    return {
      success: false,
      error: message,
    };
  }
}

/**
 * Generate clean HTML for single task reminder or multi-task digest (FR-27)
 */
export function renderReminderDigestHtml({
  userName,
  tasks,
  appUrl,
}: {
  userName: string;
  tasks: Array<{
    id: string;
    title: string;
    date: Date;
    startTime?: string | null;
    endTime?: string | null;
    priority: TaskPriority;
    location?: string | null;
    teamName?: string | null;
  }>;
  appUrl: string;
}): string {
  const isMultiple = tasks.length > 1;
  const heading = isMultiple
    ? `You have ${tasks.length} upcoming tasks scheduled`
    : `Upcoming Task Reminder: ${tasks[0].title}`;

  const taskRows = tasks
    .map((task) => {
      const timing = formatTaskTiming(task.startTime, task.endTime);
      const dateFormatted = toDateString(task.date);

      const priorityBg =
        task.priority === TaskPriority.HIGH
          ? "#fee2e2"
          : task.priority === TaskPriority.MEDIUM
          ? "#fef3c7"
          : "#f3f4f6";

      const priorityColor =
        task.priority === TaskPriority.HIGH
          ? "#b91c1c"
          : task.priority === TaskPriority.MEDIUM
          ? "#b45309"
          : "#4b5563";

      return `
        <div style="border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin-bottom: 12px; background-color: #ffffff;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <strong style="font-size: 15px; color: #111827;">${task.title}</strong>
            <span style="font-size: 10px; font-weight: bold; background-color: ${priorityBg}; color: ${priorityColor}; padding: 2px 8px; border-radius: 12px;">
              ${task.priority}
            </span>
          </div>
          <div style="font-size: 13px; color: #4b5563; margin-bottom: 4px;">
            📅 <strong>Date:</strong> ${dateFormatted} &nbsp;|&nbsp; ⏰ <strong>Time:</strong> ${timing}
          </div>
          ${
            task.location
              ? `<div style="font-size: 12px; color: #6b7280; margin-bottom: 4px;">📍 <strong>Location:</strong> ${task.location}</div>`
              : ""
          }
          ${
            task.teamName
              ? `<div style="font-size: 11px; color: #8b5cf6;">👥 Team: ${task.teamName}</div>`
              : ""
          }
        </div>
      `;
    })
    .join("");

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>${heading}</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f9fafb; margin: 0; padding: 24px; color: #111827;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; border: 1px solid #e5e7eb; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
          <!-- Header -->
          <div style="background-color: #2563eb; padding: 24px; text-align: center; color: #ffffff;">
            <h1 style="margin: 0; font-size: 20px; font-weight: bold;">Team Planner</h1>
            <p style="margin: 4px 0 0 0; font-size: 13px; opacity: 0.9;">Upcoming Schedule & Reminders</p>
          </div>

          <!-- Body -->
          <div style="padding: 24px;">
            <p style="font-size: 14px; color: #374151; margin-top: 0;">
              Hi <strong>${userName}</strong>,
            </p>
            <p style="font-size: 14px; color: #4b5563; line-height: 1.5;">
              ${
                isMultiple
                  ? `Here is your digest of tasks scheduled on your calendar:`
                  : `This is a reminder for an upcoming task on your calendar:`
              }
            </p>

            <div style="margin: 20px 0;">
              ${taskRows}
            </div>

            <!-- CTA -->
            <div style="text-align: center; margin-top: 24px;">
              <a href="${appUrl}/calendar" style="display: inline-block; background-color: #2563eb; color: #ffffff; font-size: 13px; font-weight: 600; padding: 10px 20px; border-radius: 6px; text-decoration: none;">
                Open Calendar
              </a>
            </div>
          </div>

          <!-- Footer -->
          <div style="background-color: #f9fafb; padding: 16px 24px; border-top: 1px solid #e5e7eb; text-align: center; font-size: 11px; color: #9ca3af;">
            You received this email because reminders are enabled for your Team Planner account.<br>
            Manage your reminder settings in <a href="${appUrl}/settings/account" style="color: #2563eb; text-decoration: underline;">Account Settings</a>.
          </div>
        </div>
      </body>
    </html>
  `;
}
