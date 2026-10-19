import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getCalendarTasks, getUserTeams } from "@/actions/task-actions";
import { CalendarRoot } from "@/components/calendar/calendar-root";

export const metadata = {
  title: "Calendar — Team Planner",
  description: "View and schedule personal and team tasks on an interactive calendar.",
};

export default async function CalendarPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/sign-in?callbackUrl=/calendar");
  }

  const [initialTasks, teams] = await Promise.all([
    getCalendarTasks("all"),
    getUserTeams(),
  ]);

  return <CalendarRoot initialTasks={initialTasks} teams={teams} />;
}
