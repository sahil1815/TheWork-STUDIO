"use client";

import { useState, Suspense } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { LogIn, Key, Mail, AlertCircle, Sparkles } from "lucide-react";

function SignInForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/calendar";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await signIn("credentials", {
        redirect: false,
        email,
        password,
        callbackUrl,
      });

      if (res?.error) {
        setError("Invalid email or password");
        setLoading(false);
      } else {
        router.push(callbackUrl);
        router.refresh();
      }
    } catch {
      setError("An unexpected error occurred. Please try again.");
      setLoading(false);
    }
  };

  const fillDemoAccount = (demoEmail: string) => {
    setEmail(demoEmail);
    setPassword("password123");
    setError(null);
  };

  return (
    <div className="w-full max-w-md space-y-6 rounded-3xl border border-slate-200/90 dark:border-slate-800/90 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl p-8 sm:p-9 shadow-2xl shadow-slate-200/50 dark:shadow-blue-950/20">
      <div className="text-center space-y-2">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/30">
          <LogIn className="h-6 w-6" />
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
          Welcome back
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
          Sign in to access your TheWork STUDIO workspace
        </p>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-xl bg-red-50 dark:bg-red-950/40 p-3.5 text-xs sm:text-sm text-red-700 dark:text-red-300 border border-red-200 dark:border-red-900 shadow-xs">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
            Email Address
          </label>
          <div className="relative">
            <Mail className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700/80 bg-slate-50/70 dark:bg-slate-800/60 py-2.5 pl-10 pr-3.5 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:bg-white dark:focus:bg-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
            Password
          </label>
          <div className="relative">
            <Key className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700/80 bg-slate-50/70 dark:bg-slate-800/60 py-2.5 pl-10 pr-3.5 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:bg-white dark:focus:bg-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-500/25 hover:shadow-xl hover:shadow-blue-500/30 focus:outline-none focus:ring-2 focus:ring-blue-500/40 disabled:opacity-50 transition-all hover:scale-[1.01]"
        >
          {loading ? "Signing in..." : "Sign In to Workspace"}
        </button>
      </form>

      {/* Demo Accounts Quick-Fill Section */}
      <div className="rounded-2xl border border-blue-200/80 dark:border-blue-900/60 bg-blue-50/50 dark:bg-blue-950/30 p-4 space-y-2.5">
        <div className="flex items-center gap-1.5 text-xs font-bold text-blue-900 dark:text-blue-300">
          <Sparkles className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
          <span>Quick-Fill Demo Users (Password: password123)</span>
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <button
            type="button"
            onClick={() => fillDemoAccount("alice@example.com")}
            className="rounded-xl px-2.5 py-2 text-left bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/80 hover:border-blue-500/50 hover:bg-blue-50/60 dark:hover:bg-blue-950/50 text-slate-800 dark:text-slate-200 shadow-xs transition"
          >
            <span className="font-semibold block">👑 Alice</span>
            <span className="text-[10px] text-slate-500 dark:text-slate-400">Master Admin</span>
          </button>
          <button
            type="button"
            onClick={() => fillDemoAccount("bob@example.com")}
            className="rounded-xl px-2.5 py-2 text-left bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/80 hover:border-blue-500/50 hover:bg-blue-50/60 dark:hover:bg-blue-950/50 text-slate-800 dark:text-slate-200 shadow-xs transition"
          >
            <span className="font-semibold block">🛡️ Bob</span>
            <span className="text-[10px] text-slate-500 dark:text-slate-400">Admin</span>
          </button>
          <button
            type="button"
            onClick={() => fillDemoAccount("charlie@example.com")}
            className="rounded-xl px-2.5 py-2 text-left bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/80 hover:border-blue-500/50 hover:bg-blue-50/60 dark:hover:bg-blue-950/50 text-slate-800 dark:text-slate-200 shadow-xs transition"
          >
            <span className="font-semibold block">👤 Charlie</span>
            <span className="text-[10px] text-slate-500 dark:text-slate-400">Member</span>
          </button>
          <button
            type="button"
            onClick={() => fillDemoAccount("evan@example.com")}
            className="rounded-xl px-2.5 py-2 text-left bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/80 hover:border-blue-500/50 hover:bg-blue-50/60 dark:hover:bg-blue-950/50 text-slate-800 dark:text-slate-200 shadow-xs transition"
          >
            <span className="font-semibold block">👁️ Evan</span>
            <span className="text-[10px] text-slate-500 dark:text-slate-400">Guest</span>
          </button>
        </div>
      </div>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-slate-200 dark:border-slate-800" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-white dark:bg-slate-900 px-3 text-slate-400 font-medium">Or continue with</span>
        </div>
      </div>

      <button
        type="button"
        onClick={() => signIn("google", { callbackUrl })}
        className="w-full flex items-center justify-center gap-2.5 rounded-xl border border-slate-200 dark:border-slate-700/80 bg-white dark:bg-slate-800/80 py-2.5 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition shadow-xs"
      >
        <svg className="h-4 w-4" viewBox="0 0 24 24">
          <path
            fill="#4285F4"
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
          />
          <path
            fill="#34A853"
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
          />
          <path
            fill="#FBBC05"
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
          />
          <path
            fill="#EA4335"
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
          />
        </svg>
        <span>Sign in with Google</span>
      </button>

      <p className="text-center text-xs sm:text-sm text-slate-500 dark:text-slate-400">
        Don&apos;t have an account?{" "}
        <Link href="/sign-up" className="font-semibold text-blue-600 dark:text-blue-400 hover:underline">
          Sign up
        </Link>
      </p>
    </div>
  );
}

export default function SignInPage() {
  return (
    <div className="flex min-h-[80vh] items-center justify-center py-6 px-4">
      <Suspense fallback={<div className="h-96 w-full max-w-md animate-pulse rounded-3xl bg-slate-200 dark:bg-slate-800" />}>
        <SignInForm />
      </Suspense>
    </div>
  );
}
