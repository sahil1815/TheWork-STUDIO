import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getCalendarTasks, getUserTeams } from "@/actions/task-actions";
import { TasksList } from "@/components/tasks/tasks-list";

export const metadata = {
  title: "Tasks — TheWork STUDIO",
  description: "View and organize your scheduled tasks.",
};

export default async function TasksPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/sign-in?callbackUrl=/tasks");
  }

  const [initialTasks, teams] = await Promise.all([
    getCalendarTasks("all"),
    getUserTeams(),
  ]);

  return <TasksList initialTasks={initialTasks} teams={teams} />;
}
