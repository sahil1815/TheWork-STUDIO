"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import {
  Calendar,
  CheckSquare,
  BookOpen,
  Users,
  Inbox,
  Settings,
  LogOut,
  LogIn,
  UserPlus,
  Globe,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "./theme-toggle";

export function Navbar() {
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const isLoading = status === "loading";

  const navLinks = [
    { href: "/calendar", label: "Calendar", icon: Calendar },
    { href: "/tasks", label: "Tasks", icon: CheckSquare },
    { href: "/notebook", label: "Notebook", icon: BookOpen },
    { href: "/teams", label: "Teams", icon: Users },
    { href: "/inbox", label: "Inbox", icon: Inbox },
  ];

  return (
    <>
      <header className="sticky top-0 z-40 w-full border-b border-slate-200/80 dark:border-slate-800/80 bg-white/80 dark:bg-[#090d16]/80 backdrop-blur-md transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex h-16 items-center justify-between">
          {/* Brand */}
          <div className="flex items-center gap-8">
            <Link href="/" className="flex items-center gap-2.5 group">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-violet-600 text-white font-extrabold text-sm shadow-md shadow-blue-500/25 group-hover:scale-105 transition-transform">
                TP
              </span>
              <div className="flex flex-col">
                <span className="font-bold text-base tracking-tight text-slate-900 dark:text-slate-50 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                  Team Planner
                </span>
                <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium -mt-1 tracking-wider uppercase">
                  Studio
                </span>
              </div>
            </Link>

            {/* Navigation Links (Visible when logged in) */}
            {session && (
              <nav className="hidden md:flex items-center gap-1">
                {navLinks.map((link) => {
                  const Icon = link.icon;
                  const isActive = pathname.startsWith(link.href);
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      className={cn(
                        "flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all",
                        isActive
                          ? "bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 font-semibold shadow-xs"
                          : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-900 hover:text-slate-900 dark:hover:text-slate-100"
                      )}
                    >
                      <Icon className={cn("h-4 w-4", isActive ? "text-blue-600 dark:text-blue-400" : "text-slate-500")} />
                      <span>{link.label}</span>
                    </Link>
                  );
                })}
              </nav>
            )}
          </div>

          {/* Right side controls, theme toggle, and auth */}
          <div className="flex items-center gap-2.5 sm:gap-3">
            {/* User Timezone Badge (FR-02) */}
            {session && (
              <div
                title={`Active Timezone: ${session.user.timeZone}`}
                className="hidden lg:flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700/60"
              >
                <Globe className="h-3.5 w-3.5 text-blue-500" />
                <span className="max-w-[130px] truncate">{session.user.timeZone}</span>
              </div>
            )}

            {/* Theme Toggle Button */}
            <ThemeToggle />

            {isLoading ? (
              <div className="h-9 w-24 animate-pulse rounded-lg bg-slate-200 dark:bg-slate-800" />
            ) : session ? (
              <div className="flex items-center gap-2 sm:gap-3">
                {/* User Dropdown / Settings Link */}
                <Link
                  href="/settings/account"
                  className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-850 border border-transparent hover:border-slate-200 dark:hover:border-slate-800 transition"
                >
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-tr from-blue-500 to-indigo-600 text-white text-xs font-bold shadow-xs">
                    {session.user.name?.[0]?.toUpperCase() || session.user.email?.[0]?.toUpperCase() || "U"}
                  </div>
                  <span className="hidden sm:inline font-medium text-xs max-w-[100px] truncate">
                    {session.user.name || session.user.email}
                  </span>
                  <Settings className="h-3.5 w-3.5 text-slate-400" />
                </Link>

                {/* Sign Out Button */}
                <button
                  onClick={() => signOut({ callbackUrl: "/sign-in" })}
                  className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 border border-transparent hover:border-red-200 dark:hover:border-red-900 transition"
                  title="Sign Out"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Sign Out</span>
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link
                  href="/sign-in"
                  className="flex items-center gap-1.5 px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 transition shadow-xs"
                >
                  <LogIn className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-slate-500" />
                  <span>Sign In</span>
                </Link>
                <Link
                  href="/sign-up"
                  className="flex items-center gap-1.5 px-3.5 py-1.5 sm:px-4 sm:py-2 rounded-lg text-xs sm:text-sm font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-sm shadow-blue-500/25 transition-all hover:shadow-md"
                >
                  <UserPlus className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  <span>Sign Up</span>
                </Link>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Mobile Bottom Navigation Bar */}
      {session && (
        <nav
          aria-label="Mobile Navigation"
          className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/90 dark:bg-[#090d16]/90 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 flex items-center justify-around py-1 px-2 shadow-xl"
        >
          {navLinks.map((link) => {
            const Icon = link.icon;
            const isActive = pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "flex flex-col items-center justify-center py-1.5 px-3 rounded-lg text-[10px] font-medium transition-colors",
                  isActive
                    ? "text-blue-600 dark:text-blue-400 font-bold"
                    : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
                )}
              >
                <Icon className={cn("h-5 w-5 mb-0.5", isActive && "stroke-[2.5]")} />
                <span>{link.label}</span>
              </Link>
            );
          })}
        </nav>
      )}
    </>
  );
}
