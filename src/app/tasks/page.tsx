import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getCalendarTasks, getUserTeams } from "@/actions/task-actions";
import { TasksList } from "@/components/tasks/tasks-list";

export const metadata = {
  title: "Tasks — TheWork STUDIO",
  description: "View and organize your scheduled tasks.",
};

export default async function TasksPage({
  searchParams,
}: {
  searchParams?: Promise<{ section?: string; teamId?: string; assigned?: string }>;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/sign-in?callbackUrl=/tasks");
  }

  const resolvedParams = searchParams ? await searchParams : undefined;
  const initialSection =
    resolvedParams?.section === "personal"
      ? "PERSONAL"
      : resolvedParams?.section === "team" || resolvedParams?.teamId
      ? "TEAM"
      : "ALL";

  const initialAssignment =
    resolvedParams?.assigned === "me"
      ? "ME"
      : resolvedParams?.assigned === "others"
      ? "OTHERS"
      : "ALL";

  const fetchFilter =
    resolvedParams?.section === "personal"
      ? "personal"
      : resolvedParams?.teamId
      ? resolvedParams.teamId
      : resolvedParams?.section === "team"
      ? (initialAssignment === "ME" ? "team-assigned-to-me" : initialAssignment === "OTHERS" ? "team-assigned-to-others" : "team")
      : (initialAssignment === "ME" ? "all-assigned-to-me" : initialAssignment === "OTHERS" ? "team-assigned-to-others" : "all");

  const [initialTasks, teams] = await Promise.all([
    getCalendarTasks(fetchFilter),
    getUserTeams(),
  ]);

  return (
    <TasksList
      initialTasks={initialTasks}
      teams={teams}
      currentUserId={session.user.id!}
      initialSection={initialSection}
      initialTeamId={resolvedParams?.teamId}
      initialAssignment={initialAssignment}
    />
  );
}
