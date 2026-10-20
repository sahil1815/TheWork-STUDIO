"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { ArrowRight, Calendar, CheckSquare } from "lucide-react";

export function HomeAuthRedirect() {
  const { status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "authenticated") {
      router.replace("/calendar");
    }
  }, [status, router]);

  return null;
}

export function HeroCta() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "authenticated") {
      router.replace("/calendar");
    }
  }, [status, router]);

  if (session?.user) {
    return (
      <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5 pt-2">
        <Link
          href="/calendar"
          className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 px-7 py-3.5 text-base font-semibold text-white shadow-lg shadow-blue-500/25 hover:shadow-xl hover:shadow-blue-500/30 transition-all hover:scale-[1.02]"
        >
          <Calendar className="h-4 w-4" />
          <span>Go to Workspace</span>
          <ArrowRight className="h-4 w-4" />
        </Link>
        <Link
          href="/tasks"
          className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900/90 px-6 py-3.5 text-base font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/90 transition-all hover:scale-[1.02] shadow-xs"
        >
          <CheckSquare className="h-4 w-4 text-slate-400" />
          <span>View My Tasks</span>
        </Link>
      </div>
    );
  }

  return (
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
  );
}

export function BottomCta() {
  const { data: session } = useSession();

  if (session?.user) {
    return (
      <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
        <Link
          href="/calendar"
          className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 px-6 py-3 text-sm font-semibold text-white shadow-md shadow-blue-500/25 transition-all hover:scale-105"
        >
          <Calendar className="h-4 w-4" />
          <span>Open Workspace</span>
          <ArrowRight className="h-4 w-4" />
        </Link>
        <Link
          href="/tasks"
          className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-6 py-3 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition shadow-xs"
        >
          <CheckSquare className="h-4 w-4 text-slate-400" />
          <span>View Tasks</span>
        </Link>
      </div>
    );
  }

  return (
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
  );
}
