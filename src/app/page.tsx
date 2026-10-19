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
  Sparkles,
  CheckCircle2,
  Clock,
  Layers,
  Zap,
} from "lucide-react";

export default async function HomePage() {
  const session = await auth();

  if (session?.user) {
    redirect("/calendar");
  }

  const features = [
    {
      title: "Personal & Team Calendar",
      description:
        "Effortlessly schedule tasks across Month, Week, Day, and Agenda views with zero-latency HTML5 drag-and-drop rescheduling.",
      icon: Calendar,
      badge: "Interactive Views",
      color: "from-blue-500/20 to-blue-600/20 text-blue-600 dark:text-blue-400",
    },
    {
      title: "Task Proposals with Consensus",
      description:
        "Propose assignments to teammates. Review pending items in a unified 4-tab inbox; accepted tasks automatically sync to calendars.",
      icon: Inbox,
      badge: "Approval Workflow",
      color: "from-indigo-500/20 to-indigo-600/20 text-indigo-600 dark:text-indigo-400",
    },
    {
      title: "Multi-Role Team Workspaces",
      description:
        "Granular 4-tier role hierarchy (Master Admin, Admin, Member, Guest) with secure two-step join requests and ownership transfers.",
      icon: Users,
      badge: "Role-Based Access",
      color: "from-violet-500/20 to-violet-600/20 text-violet-600 dark:text-violet-400",
    },
    {
      title: "Private & Shared Notebooks",
      description:
        "Autosaving rich Markdown notebook with instant tag indexing, live search, and granular sharing controls for teams and guests.",
      icon: BookOpen,
      badge: "Markdown & Tags",
      color: "from-emerald-500/20 to-emerald-600/20 text-emerald-600 dark:text-emerald-400",
    },
    {
      title: "Timezone-Aware Reminders",
      description:
        "Automated email reminders dispatched at 3 days, 1 day, and morning of tasks, strictly calculated in each user's local timezone.",
      icon: Bell,
      badge: "Intelligent Queue",
      color: "from-amber-500/20 to-amber-600/20 text-amber-600 dark:text-amber-400",
    },
    {
      title: "Enterprise Security Architecture",
      description:
        "Strict database constraints, SHA-256 tokens, PostgreSQL row-level locks, and daily email quota protection on a $0 free tier.",
      icon: ShieldCheck,
      badge: "Zero-Cost Cloud",
      color: "from-rose-500/20 to-rose-600/20 text-rose-600 dark:text-rose-400",
    },
  ];

  return (
    <div className="relative py-8 sm:py-16 space-y-20 sm:space-y-28 overflow-hidden">
      {/* Ambient gradient glow in hero background */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 -z-10 w-[800px] max-w-full h-[450px] bg-gradient-to-b from-blue-500/15 via-indigo-500/10 to-transparent blur-3xl pointer-events-none opacity-80 dark:opacity-40" />

      {/* Hero Section */}
      <section className="text-center space-y-8 max-w-4xl mx-auto px-4">
        {/* Announcement Pill */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200/90 dark:border-blue-800/80 shadow-xs">
          <Sparkles className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
          <span>The Modern Workspace for High-Velocity Teams</span>
        </div>

        {/* Headline */}
        <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-slate-900 dark:text-white leading-[1.12]">
          Where high-performing teams{" "}
          <span className="bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 dark:from-blue-400 dark:via-indigo-300 dark:to-violet-400 bg-clip-text text-transparent">
            plan, schedule, & collaborate.
          </span>
        </h1>

        {/* Subtitle */}
        <p className="text-base sm:text-xl text-slate-600 dark:text-slate-300 max-w-2xl mx-auto font-normal leading-relaxed">
          A unified platform combining interactive team calendars, peer task proposals with consensus workflows, rich Markdown notebooks, and intelligent timezone-aware reminder dispatches.
        </p>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5 pt-2">
          <Link
            href="/sign-up"
            className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 px-7 py-3.5 text-base font-semibold text-white shadow-lg shadow-blue-500/25 hover:shadow-xl hover:shadow-blue-500/30 transition-all hover:scale-[1.02]"
          >
            <span>Get Started Free</span>
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/sign-in"
            className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900/90 px-6 py-3.5 text-base font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/90 transition-all hover:scale-[1.02] shadow-xs"
          >
            <span>Sign In to Workspace</span>
          </Link>
        </div>

        {/* Feature Highlights Pills */}
        <div className="pt-4 flex flex-wrap items-center justify-center gap-y-2 gap-x-6 text-xs font-medium text-slate-500 dark:text-slate-400">
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            <span>100% Free Architecture</span>
          </div>
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            <span>Automatic IANA Timezones</span>
          </div>
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            <span>Role-Based Access Control</span>
          </div>
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            <span>Instant HTML5 Drag & Drop</span>
          </div>
        </div>
      </section>

      {/* Visual Product UI Mockup Preview */}
      <section className="max-w-5xl mx-auto px-4">
        <div className="relative rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/80 backdrop-blur-xl p-4 sm:p-6 shadow-2xl shadow-slate-200/50 dark:shadow-blue-950/20">
          {/* Mock Window Top Bar */}
          <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-red-400/80" />
              <span className="h-3 w-3 rounded-full bg-amber-400/80" />
              <span className="h-3 w-3 rounded-full bg-emerald-400/80" />
              <span className="ml-3 text-xs font-medium text-slate-500 dark:text-slate-400 hidden sm:inline">
                Team Planner — Engineering Workspace
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs font-semibold px-2.5 py-1 rounded-md bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400">
              <Clock className="h-3.5 w-3.5" />
              <span>Live Timezone: UTC Sync</span>
            </div>
          </div>

          {/* Mock Content Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Calendar Task Column */}
            <div className="md:col-span-2 rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-slate-50/60 dark:bg-slate-950/60 p-4 space-y-3">
              <div className="flex items-center justify-between text-xs font-bold text-slate-800 dark:text-slate-200">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-blue-500" />
                  <span>Today&apos;s Schedule (Month / Week / Day)</span>
                </div>
                <span className="text-blue-600 dark:text-blue-400 font-medium">3 Tasks Due</span>
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center justify-between p-3 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
                  <div className="flex items-center gap-3">
                    <span className="h-2 w-2 rounded-full bg-rose-500" />
                    <div>
                      <p className="text-xs font-bold text-slate-800 dark:text-slate-200">Product Architecture Review</p>
                      <p className="text-[11px] text-slate-500">10:00 AM - 11:30 AM • Engineering Team</p>
                    </div>
                  </div>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300">
                    HIGH
                  </span>
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
                  <div className="flex items-center gap-3">
                    <span className="h-2 w-2 rounded-full bg-blue-500" />
                    <div>
                      <p className="text-xs font-bold text-slate-800 dark:text-slate-200">Review Teammate Proposals</p>
                      <p className="text-[11px] text-slate-500">02:00 PM - 03:00 PM • Inbox (2 pending)</p>
                    </div>
                  </div>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300">
                    PROPOSAL
                  </span>
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
                  <div className="flex items-center gap-3">
                    <span className="h-2 w-2 rounded-full bg-emerald-500" />
                    <div>
                      <p className="text-xs font-bold text-slate-800 dark:text-slate-200">Deploy Production Release</p>
                      <p className="text-[11px] text-slate-500">05:00 PM - 05:30 PM • Verified Free Tier</p>
                    </div>
                  </div>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300">
                    AUTOMATED
                  </span>
                </div>
              </div>
            </div>

            {/* Notebook Column */}
            <div className="rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-slate-50/60 dark:bg-slate-950/60 p-4 space-y-3">
              <div className="flex items-center justify-between text-xs font-bold text-slate-800 dark:text-slate-200">
                <div className="flex items-center gap-2">
                  <BookOpen className="h-4 w-4 text-emerald-500" />
                  <span>Shared Notebook</span>
                </div>
                <span className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400">Autosaved</span>
              </div>

              <div className="rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3 space-y-2 shadow-xs text-xs">
                <p className="font-bold text-slate-800 dark:text-slate-200">Sprint 14 Decision Log</p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                  Consensus reached on peer proposals workflow and PostgreSQL row locks for reminder jobs.
                </p>
                <div className="flex flex-wrap gap-1 pt-1">
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 font-mono text-slate-600 dark:text-slate-300">
                    #architecture
                  </span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 font-mono text-slate-600 dark:text-slate-300">
                    #sprint-14
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Grid */}
      <section className="space-y-12 max-w-6xl mx-auto px-4">
        <div className="text-center space-y-3 max-w-2xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Engineered for clarity, speed, & control.
          </h2>
          <p className="text-slate-600 dark:text-slate-400 text-sm sm:text-base">
            Every feature is built with zero fluff and strict performance guarantees.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature) => {
            const Icon = feature.icon;
            return (
              <div
                key={feature.title}
                className="group relative rounded-2xl border border-slate-200/90 dark:border-slate-800/90 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm p-6 space-y-4 shadow-sm hover:shadow-xl hover:border-blue-500/40 dark:hover:border-blue-500/40 transition-all duration-300 hover:-translate-y-1"
              >
                <div className="flex items-center justify-between">
                  <div
                    className={`flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br ${feature.color} shadow-xs group-hover:scale-110 transition-transform`}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200/60 dark:border-slate-700/60">
                    {feature.badge}
                  </span>
                </div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                  {feature.title}
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                  {feature.description}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Production Architecture & Seed Quick-Start Callout */}
      <section className="max-w-4xl mx-auto px-4">
        <div className="rounded-3xl border border-blue-200 dark:border-blue-900/60 bg-gradient-to-br from-blue-500/10 via-indigo-500/5 to-transparent dark:from-blue-950/40 dark:via-indigo-950/20 p-8 sm:p-10 space-y-6 text-center">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-md shadow-blue-500/30 mx-auto">
            <Zap className="h-6 w-6" />
          </div>
          <div className="space-y-2">
            <h3 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">
              Ready to experience modern team scheduling?
            </h3>
            <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 max-w-xl mx-auto">
              Sign up with any email or test immediately with pre-configured demo roles (Owner, Admin, Member, Guest) on the sign-in screen.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <Link
              href="/sign-up"
              className="w-full sm:w-auto rounded-xl bg-blue-600 hover:bg-blue-700 px-6 py-3 text-sm font-semibold text-white shadow-md shadow-blue-500/25 transition-all hover:scale-105"
            >
              Create Free Account
            </Link>
            <Link
              href="/sign-in"
              className="w-full sm:w-auto rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-6 py-3 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition shadow-xs"
            >
              Explore Demo Accounts
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
