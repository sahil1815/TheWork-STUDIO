import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getCalendarTasks, getUserTeams, getDefaultCalendarView } from "@/actions/task-actions";
import { CalendarRoot, CalendarViewMode } from "@/components/calendar/calendar-root";

export const metadata = {
  title: "Calendar — TheWork STUDIO",
  description: "View and schedule personal and team tasks on an interactive calendar.",
};

interface CalendarPageProps {
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function CalendarPage({ searchParams }: CalendarPageProps) {
  const session = await auth();

  if (!session?.user) {
    redirect("/sign-in?callbackUrl=/calendar");
  }

  const resolvedParams = searchParams ? await searchParams : {};
  const queryViewRaw = resolvedParams?.view;
  const queryView = typeof queryViewRaw === "string" ? queryViewRaw.toLowerCase() : undefined;
  const queryFilterRaw = resolvedParams?.filter;
  const queryFilter = typeof queryFilterRaw === "string" ? queryFilterRaw : undefined;
  const initialFilter = queryFilter || "all";

  const [initialTasks, teams, userDefaultView] = await Promise.all([
    getCalendarTasks(initialFilter),
    getUserTeams(),
    getDefaultCalendarView(),
  ]);

  const validModes: CalendarViewMode[] = ["month", "week", "day", "agenda"];
  const initialViewMode: CalendarViewMode =
    queryView && (validModes as string[]).includes(queryView)
      ? (queryView as CalendarViewMode)
      : userDefaultView;

  return (
    <CalendarRoot
      initialTasks={initialTasks}
      teams={teams}
      currentUserId={session.user.id!}
      defaultView={userDefaultView}
      initialViewMode={initialViewMode}
      initialFilter={initialFilter}
    />
  );
}
