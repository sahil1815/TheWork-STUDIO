import Link from "next/link";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import {
  Calendar,
  Users,
  Inbox,
  BookOpen,
  Bell,
  ShieldCheck,
  ArrowRight,
  CheckCircle2,
} from "lucide-react";

export default async function HomePage() {
  const session = await auth();

  if (session?.user) {
    redirect("/calendar");
  }

  const features = [
    {
      title: "Personal & Team Calendar",
      description: "Schedule personal and team tasks with granular month, week, day, and agenda views.",
      icon: Calendar,
      badge: "FR-01 to FR-09",
    },
    {
      title: "Task Proposals with Approval",
      description: "Propose tasks to teammates. Once accepted, items automatically appear on their calendar.",
      icon: Inbox,
      badge: "FR-17 to FR-19",
    },
    {
      title: "Multi-Role Team Management",
      description: "Master Admin, Admin, Member, and Guest roles with two-step invitation approval.",
      icon: Users,
      badge: "FR-10 to FR-16",
    },
    {
      title: "Private & Shared Notebook",
      description: "Rich-text notebook, private by default, with selective sharing to team members or groups.",
      icon: BookOpen,
      badge: "FR-20 to FR-23",
    },
    {
      title: "Automated Resend Reminders",
      description: "3 days before, 1 day before, and at 12:00 AM on the day of the task in your local timezone.",
      icon: Bell,
      badge: "FR-24 to FR-27",
    },
    {
      title: "100% Free Architecture",
      description: "Runs entirely on $0 tiers: Next.js, Neon PostgreSQL, Resend, and external cron triggers.",
      icon: ShieldCheck,
      badge: "Constraints C1-C5",
    },
  ];

  return (
    <div className="py-12 space-y-16">
      {/* Hero */}
      <div className="text-center space-y-6 max-w-3xl mx-auto">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
          <CheckCircle2 className="h-3.5 w-3.5" />
          <span>Production Ready • 100% Free Tier Architecture</span>
        </div>
        <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-50">
          Team scheduling, collaboration, and notebook web app
        </h1>
        <p className="text-lg text-zinc-600 dark:text-zinc-400">
          Schedule tasks, coordinate with teammates via proposals, maintain private or shared notes, and receive automated email reminders on time.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
          <Link
            href="/sign-up"
            className="flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-3 text-base font-semibold text-white shadow-md hover:bg-blue-700 transition"
          >
            <span>Get Started Free</span>
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/sign-in"
            className="flex items-center gap-2 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-6 py-3 text-base font-semibold text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-700/50 transition"
          >
            <span>Sign In to Existing Account</span>
          </Link>
        </div>
      </div>

      {/* Feature Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {features.map((feature) => {
          const Icon = feature.icon;
          return (
            <div
              key={feature.title}
              className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 space-y-3 shadow-sm hover:shadow-md transition"
            >
              <div className="flex items-center justify-between">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 dark:bg-blue-950/60 text-blue-600">
                  <Icon className="h-5 w-5" />
                </div>
                <span className="text-[11px] font-mono font-medium px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                  {feature.badge}
                </span>
              </div>
              <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                {feature.title}
              </h2>
              <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
                {feature.description}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
