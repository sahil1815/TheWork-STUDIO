import { auth } from "@/lib/auth";
import { notFound, redirect } from "next/navigation";
import { getTeamDetails } from "@/actions/team-actions";
import { TeamDashboard } from "@/components/teams/team-dashboard";

export const metadata = {
  title: "Team Management — TheWork STUDIO",
  description: "Manage team members, roles, and invitations.",
};

export default async function TeamDetailPage({
  params,
}: {
  params: Promise<{ teamId: string }>;
}) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/sign-in");
  }

  const { teamId } = await params;
  const team = await getTeamDetails(teamId);

  if (!team) {
    notFound();
  }

  return <TeamDashboard team={team} currentUserId={session.user.id} />;
}
