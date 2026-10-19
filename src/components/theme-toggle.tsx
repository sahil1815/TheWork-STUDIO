"use client";

import { useTheme } from "./providers/theme-provider";
import { Sun, Moon, Laptop } from "lucide-react";
import { useState, useRef, useEffect } from "react";

export function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-label="Toggle color theme"
        className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100 transition shadow-sm"
      >
        {resolvedTheme === "dark" ? (
          <Moon className="h-4 w-4 text-blue-400" />
        ) : (
          <Sun className="h-4 w-4 text-amber-500" />
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-36 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-1.5 shadow-xl z-50 animate-in fade-in slide-in-from-top-1">
          <button
            type="button"
            onClick={() => {
              setTheme("light");
              setOpen(false);
            }}
            className={`flex w-full items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium transition ${
              theme === "light"
                ? "bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 font-semibold"
                : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
            }`}
          >
            <Sun className="h-3.5 w-3.5 text-amber-500" />
            <span>Light</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setTheme("dark");
              setOpen(false);
            }}
            className={`flex w-full items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium transition ${
              theme === "dark"
                ? "bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 font-semibold"
                : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
            }`}
          >
            <Moon className="h-3.5 w-3.5 text-blue-400" />
            <span>Dark</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setTheme("system");
              setOpen(false);
            }}
            className={`flex w-full items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium transition ${
              theme === "system"
                ? "bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 font-semibold"
                : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
            }`}
          >
            <Laptop className="h-3.5 w-3.5 text-slate-500" />
            <span>System</span>
          </button>
        </div>
      )}
    </div>
  );
}
