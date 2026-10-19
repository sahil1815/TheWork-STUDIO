import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getUserTeams } from "@/actions/task-actions";
import { TeamsList } from "@/components/teams/teams-list";

export const metadata = {
  title: "Teams — TheWork STUDIO",
  description: "View and manage your collaboration teams.",
};

export default async function TeamsPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/sign-in?callbackUrl=/teams");
  }

  const teams = await getUserTeams();

  return <TeamsList teams={teams} />;
}
