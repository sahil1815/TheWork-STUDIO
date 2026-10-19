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
  let fromEmail = process.env.EMAIL_FROM || "TheWork STUDIO <notifications@adorousfashion.store>";
  if (fromEmail.includes("<") && fromEmail.includes(">")) {
    const address = fromEmail.substring(fromEmail.indexOf("<") + 1, fromEmail.indexOf(">")).trim();
    fromEmail = `TheWork STUDIO <${address}>`;
  }
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
            <h1 style="margin: 0; font-size: 20px; font-weight: bold;">TheWork STUDIO</h1>
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
            You received this email because reminders are enabled for your TheWork STUDIO account.<br>
            Manage your reminder settings in <a href="${appUrl}/settings/account" style="color: #2563eb; text-decoration: underline;">Account Settings</a>.
          </div>
        </div>
      </body>
    </html>
  `;
}

/**
 * Resolves the application base URL dynamically from request headers or environment variables
 */
export async function getBaseUrl(): Promise<string> {
  try {
    const { headers } = await import("next/headers");
    const headerList = await headers();
    const host = headerList.get("x-forwarded-host") || headerList.get("host");
    const proto =
      headerList.get("x-forwarded-proto") ||
      (host?.includes("localhost") ? "http" : "https");
    if (host) {
      return `${proto}://${host}`;
    }
  } catch {
    // Fallback if headers() is unavailable
  }

  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  }
  if (process.env.NEXTAUTH_URL) {
    return process.env.NEXTAUTH_URL.replace(/\/$/, "");
  }
  if (process.env.VERCEL_URL) {
    const v = process.env.VERCEL_URL.replace(/\/$/, "");
    return v.startsWith("http") ? v : `https://${v}`;
  }
  return "http://localhost:3000";
}

/**
 * Generate clean, modern HTML for team invitation emails (FR-15, FR-16)
 */
export function renderTeamInvitationHtml({
  teamName,
  inviterName,
  inviterEmail,
  role,
  inviteUrl,
  expiresInDays = 7,
}: {
  teamName: string;
  inviterName?: string | null;
  inviterEmail?: string | null;
  role: string;
  inviteUrl: string;
  expiresInDays?: number;
}): string {
  const inviterDisplay = inviterName
    ? `${inviterName} (${inviterEmail || ""})`.trim()
    : inviterEmail || "A team admin";

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Invitation to join ${teamName}</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f9fafb; margin: 0; padding: 24px; color: #111827; line-height: 1.5;">
        <div style="max-width: 560px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; border: 1px solid #e5e7eb; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
          <!-- Header -->
          <div style="background-color: #2563eb; padding: 28px 24px; text-align: center; color: #ffffff;">
            <h1 style="margin: 0; font-size: 22px; font-weight: 700; letter-spacing: -0.02em;">TheWork STUDIO</h1>
            <p style="margin: 6px 0 0 0; font-size: 13px; opacity: 0.9;">Team Collaboration & Workspace</p>
          </div>

          <!-- Body -->
          <div style="padding: 32px 24px;">
            <p style="font-size: 15px; color: #374151; margin-top: 0;">
              Hello,
            </p>
            <p style="font-size: 15px; color: #4b5563; line-height: 1.6;">
              <strong>${inviterDisplay}</strong> has invited you to join the team <strong style="color: #2563eb;">${teamName}</strong> on TheWork STUDIO as <strong>${role}</strong>.
            </p>

            <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 24px 0;">
              <div style="font-size: 11px; font-weight: 700; color: #64748b; letter-spacing: 0.05em; text-transform: uppercase; margin-bottom: 8px;">TEAM INVITATION DETAILS</div>
              <div style="font-size: 14px; color: #1e293b; margin-bottom: 6px;">👥 <strong>Team:</strong> ${teamName}</div>
              <div style="font-size: 14px; color: #1e293b; margin-bottom: 6px;">🏷️ <strong>Assigned Role:</strong> <span style="display: inline-block; background-color: #dbeafe; color: #1d4ed8; font-weight: 600; font-size: 12px; padding: 2px 8px; border-radius: 12px;">${role}</span></div>
              <div style="font-size: 12px; color: #94a3b8; margin-top: 8px;">⏳ This single-use invitation link expires in <strong>${expiresInDays} days</strong>.</div>
            </div>

            <!-- CTA Button -->
            <div style="text-align: center; margin: 32px 0;">
              <a href="${inviteUrl}" style="display: inline-block; background-color: #2563eb; color: #ffffff; font-size: 14px; font-weight: 600; padding: 12px 28px; border-radius: 8px; text-decoration: none; box-shadow: 0 1px 2px rgba(0,0,0,0.05);">
                Accept Invitation
              </a>
            </div>

            <p style="font-size: 12px; color: #6b7280; line-height: 1.5; margin-bottom: 0;">
              If the button above doesn't work, copy and paste this link into your browser:<br>
              <a href="${inviteUrl}" style="color: #2563eb; word-break: break-all;">${inviteUrl}</a>
            </p>
          </div>

          <!-- Footer -->
          <div style="background-color: #f9fafb; padding: 16px 24px; border-top: 1px solid #e5e7eb; text-align: center; font-size: 11px; color: #9ca3af;">
            You received this email because an invitation was sent to this address from TheWork STUDIO.<br>
            If you did not expect this invitation, you can safely ignore this email.
          </div>
        </div>
      </body>
    </html>
  `;
}

