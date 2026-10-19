"use client";

import { useState, useEffect } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { UserPlus, User, Mail, Key, Globe, AlertCircle } from "lucide-react";

export default function SignUpPage() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [timeZone, setTimeZone] = useState("UTC");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (detected) setTimeZone(detected);
    } catch {
      // Fallback stays UTC
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, timeZone }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to create account");
        setLoading(false);
        return;
      }

      // Auto-sign in on success
      const signInRes = await signIn("credentials", {
        redirect: false,
        email,
        password,
        callbackUrl: "/calendar",
      });

      if (signInRes?.error) {
        router.push("/sign-in");
      } else {
        router.push("/calendar");
        router.refresh();
      }
    } catch {
      setError("An unexpected network error occurred. Please try again.");
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-[80vh] items-center justify-center py-6 px-4">
      <div className="w-full max-w-md space-y-6 rounded-3xl border border-slate-200/90 dark:border-slate-800/90 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl p-8 sm:p-9 shadow-2xl shadow-slate-200/50 dark:shadow-blue-950/20">
        <div className="text-center space-y-2">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/30">
            <UserPlus className="h-6 w-6" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            Create an account
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            Get started with your free TheWork STUDIO account
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
              Full Name
            </label>
            <div className="relative">
              <User className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Jane Doe"
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700/80 bg-slate-50/70 dark:bg-slate-800/60 py-2.5 pl-10 pr-3.5 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:bg-white dark:focus:bg-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition"
              />
            </div>
          </div>

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
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 6 characters"
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700/80 bg-slate-50/70 dark:bg-slate-800/60 py-2.5 pl-10 pr-3.5 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:bg-white dark:focus:bg-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
              Detected Time Zone (IANA)
            </label>
            <div className="relative">
              <Globe className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
              <input
                type="text"
                required
                value={timeZone}
                onChange={(e) => setTimeZone(e.target.value)}
                placeholder="e.g. America/New_York or Asia/Dhaka"
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700/80 bg-slate-50/70 dark:bg-slate-800/60 py-2.5 pl-10 pr-3.5 text-sm font-mono text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:bg-white dark:focus:bg-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition"
              />
            </div>
            <p className="mt-1.5 text-[11px] text-slate-500 dark:text-slate-400">
              Auto-detected from browser. Used for scheduling reminders accurately.
            </p>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-500/25 hover:shadow-xl hover:shadow-blue-500/30 focus:outline-none focus:ring-2 focus:ring-blue-500/40 disabled:opacity-50 transition-all hover:scale-[1.01]"
          >
            {loading ? "Creating account..." : "Create Free Account"}
          </button>
        </form>

        <p className="text-center text-xs sm:text-sm text-slate-500 dark:text-slate-400">
          Already have an account?{" "}
          <Link href="/sign-in" className="font-semibold text-blue-600 dark:text-blue-400 hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
