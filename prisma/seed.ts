import { PrismaClient, Role, TaskStatus, TaskPriority, ProposalStatus, NoteShareTargetType, NotePermission, ReminderJobStatus } from "@prisma/client";
import bcrypt from "bcryptjs";
import { addDays, setHours, setMinutes, setSeconds, subMinutes } from "date-fns";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  // Clean existing data
  await prisma.notification.deleteMany();
  await prisma.reminderJob.deleteMany();
  await prisma.taskReminderOverride.deleteMany();
  await prisma.reminderPreference.deleteMany();
  await prisma.noteShare.deleteMany();
  await prisma.note.deleteMany();
  await prisma.task.deleteMany();
  await prisma.taskProposal.deleteMany();
  await prisma.teamInvitation.deleteMany();
  await prisma.teamMember.deleteMany();
  await prisma.team.deleteMany();
  await prisma.session.deleteMany();
  await prisma.account.deleteMany();
  await prisma.user.deleteMany();

  const passwordHash = await bcrypt.hash("password123", 10);

  // 1. Create Users
  const alice = await prisma.user.create({
    data: {
      name: "Alice Vance (Master Admin)",
      email: "alice@example.com",
      passwordHash,
      timeZone: "America/New_York",
    },
  });

  const bob = await prisma.user.create({
    data: {
      name: "Bob Builder (Admin)",
      email: "bob@example.com",
      passwordHash,
      timeZone: "Europe/London",
    },
  });

  const charlie = await prisma.user.create({
    data: {
      name: "Charlie Day (Member)",
      email: "charlie@example.com",
      passwordHash,
      timeZone: "Asia/Dhaka",
    },
  });

  const dave = await prisma.user.create({
    data: {
      name: "Dave Miller (Guest)",
      email: "dave@example.com",
      passwordHash,
      timeZone: "Asia/Tokyo",
    },
  });

  const eve = await prisma.user.create({
    data: {
      name: "Eve Solo (Independent)",
      email: "eve@example.com",
      passwordHash,
      timeZone: "UTC",
    },
  });

  // Reminder preferences for users
  for (const user of [alice, bob, charlie, dave, eve]) {
    await prisma.reminderPreference.create({
      data: {
        userId: user.id,
        defaultOffsets: [4320, 1440, 0], // 3 days, 1 day, day of task 00:00
        enabled: true,
      },
    });
  }

  // 2. Create Team
  const team = await prisma.team.create({
    data: {
      name: "Acme Product Team",
    },
  });

  // 3. Create Team Members (all four roles)
  await prisma.teamMember.createMany({
    data: [
      { teamId: team.id, userId: alice.id, role: Role.OWNER },
      { teamId: team.id, userId: bob.id, role: Role.ADMIN },
      { teamId: team.id, userId: charlie.id, role: Role.MEMBER },
      { teamId: team.id, userId: dave.id, role: Role.GUEST },
    ],
  });

  const today = new Date();
  const tomorrow = addDays(today, 1);
  const threeDaysLater = addDays(today, 3);
  const fiveDaysLater = addDays(today, 5);

  // 4. Create Personal Tasks
  const alicePersonalAllDay = await prisma.task.create({
    data: {
      title: "Review Quarterly Strategy",
      date: tomorrow,
      description: "Review financial reports and upcoming OKRs for Q4.",
      status: TaskStatus.TODO,
      priority: TaskPriority.HIGH,
      createdById: alice.id,
      assigneeId: alice.id,
      color: "#3b82f6",
    },
  });

  const alicePersonalTimed = await prisma.task.create({
    data: {
      title: "Dentist Appointment",
      date: tomorrow,
      startTime: "10:00",
      endTime: "11:00",
      description: "Bi-annual cleaning appointment.",
      status: TaskStatus.TODO,
      priority: TaskPriority.MEDIUM,
      location: "Downtown Dental Clinic",
      createdById: alice.id,
      assigneeId: alice.id,
      color: "#10b981",
    },
  });

  // 5. Create Team Task assigned to Charlie
  const teamTaskCharlie = await prisma.task.create({
    data: {
      title: "Implement Authentication Flow",
      date: threeDaysLater,
      startTime: "14:00",
      endTime: "16:00",
      description: "Connect NextAuth and verify session callbacks on App Router.",
      status: TaskStatus.IN_PROGRESS,
      priority: TaskPriority.HIGH,
      teamId: team.id,
      createdById: alice.id,
      assigneeId: charlie.id,
      color: "#8b5cf6",
    },
  });

  // 6. Create Task Proposal from Bob to Charlie
  const proposal = await prisma.taskProposal.create({
    data: {
      teamId: team.id,
      proposerId: bob.id,
      recipientId: charlie.id,
      title: "Design Database Migration Architecture",
      date: fiveDaysLater,
      startTime: "09:00",
      endTime: "10:30",
      description: "Draft the PostgreSQL migration steps with zero downtime.",
      priority: TaskPriority.HIGH,
      status: ProposalStatus.PENDING,
      message: "Hey Charlie, could you lead the database migration design for this sprint?",
      expiresAt: addDays(today, 14),
    },
  });

  // 7. Create Notes
  // Private note for Alice
  const alicePrivateNote = await prisma.note.create({
    data: {
      authorId: alice.id,
      title: "Private Roadmap Thoughts",
      contentJson: {
        type: "doc",
        content: [
          {
            type: "paragraph",
            text: "Confidential plans for expanding product scheduling capabilities.",
          },
        ],
      },
      contentText: "Confidential plans for expanding product scheduling capabilities.",
      pinned: true,
      tags: ["private", "strategy"],
    },
  });

  // Team shared note for Alice
  const sprintBlueprintNote = await prisma.note.create({
    data: {
      authorId: alice.id,
      title: "Sprint 42 Architecture Blueprint",
      contentJson: {
        type: "doc",
        content: [
          {
            type: "paragraph",
            text: "Sprint 42 overview: Micro-scheduling, NextAuth session flow, and Resend cron worker.",
          },
        ],
      },
      contentText: "Sprint 42 overview: Micro-scheduling, NextAuth session flow, and Resend cron worker.",
      pinned: false,
      tags: ["architecture", "sprint-42"],
    },
  });

  // Share blueprint with entire team (VIEW) and specifically Bob (EDIT)
  await prisma.noteShare.createMany({
    data: [
      {
        noteId: sprintBlueprintNote.id,
        targetType: NoteShareTargetType.TEAM,
        targetId: team.id,
        permission: NotePermission.VIEW,
      },
      {
        noteId: sprintBlueprintNote.id,
        targetType: NoteShareTargetType.USER,
        targetId: bob.id,
        permission: NotePermission.EDIT,
      },
    ],
  });

  // 8. Create Reminder Jobs for Timed Personal Task
  const midnightDayOfTask = setHours(setMinutes(setSeconds(tomorrow, 0), 0), 0);
  const oneDayBefore = subMinutes(midnightDayOfTask, 1440);
  const threeDaysBefore = subMinutes(midnightDayOfTask, 4320);

  await prisma.reminderJob.createMany({
    data: [
      {
        taskId: alicePersonalTimed.id,
        userId: alice.id,
        offsetMinutes: 4320, // 3 days before
        sendAt: threeDaysBefore,
        status: ReminderJobStatus.SKIPPED, // Skipped since task was scheduled for tomorrow
      },
      {
        taskId: alicePersonalTimed.id,
        userId: alice.id,
        offsetMinutes: 1440, // 1 day before
        sendAt: oneDayBefore,
        status: ReminderJobStatus.PENDING,
      },
      {
        taskId: alicePersonalTimed.id,
        userId: alice.id,
        offsetMinutes: 0, // Day of task at 00:00
        sendAt: midnightDayOfTask,
        status: ReminderJobStatus.PENDING,
      },
    ],
  });

  // 9. Create in-app notification for Charlie
  await prisma.notification.create({
    data: {
      userId: charlie.id,
      type: "TASK_PROPOSAL",
      title: "New Task Proposal from Bob Builder",
      message: "Bob Builder proposed: 'Design Database Migration Architecture'",
      link: "/inbox",
      data: { proposalId: proposal.id },
    },
  });

  console.log("Seeding completed successfully!");
}

main()
  .catch((e) => {
    console.error("Seeding error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
