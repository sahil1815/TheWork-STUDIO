import type { Metadata } from "next";
import "./globals.css";
import { SessionProvider } from "@/components/providers/session-provider";
import { Navbar } from "@/components/navbar";
import { TimeZoneDetector } from "@/components/timezone-detector";

export const metadata: Metadata = {
  title: "Team Planner — Scheduling, Teams & Notebook",
  description: "Personal and team scheduling, task proposals, rich notebook, and automated email reminders.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased flex flex-col min-h-screen">
        <SessionProvider>
          <TimeZoneDetector />
          <Navbar />
          <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-20 md:pb-6">
            {children}
          </main>
        </SessionProvider>
      </body>
    </html>
  );
}
