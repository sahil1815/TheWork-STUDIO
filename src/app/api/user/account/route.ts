import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { Role } from "@prisma/client";

export async function DELETE() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;

    // Check if user is Master Admin (OWNER) of any team (Section 9 Edge Case)
    const ownedTeams = await db.teamMember.findMany({
      where: {
        userId,
        role: Role.OWNER,
      },
      include: {
        team: { select: { name: true } },
      },
    });

    if (ownedTeams.length > 0) {
      const teamNames = ownedTeams.map((m) => `"${m.team.name}"`).join(", ");
      return NextResponse.json(
        {
          error: `Cannot delete account while you are the Master Admin of: ${teamNames}. Please transfer ownership or delete the team(s) first.`,
        },
        { status: 400 }
      );
    }

    // Cascade delete user
    await db.user.delete({
      where: { id: userId },
    });

    return NextResponse.json({ success: true, message: "Account deleted successfully" });
  } catch (error) {
    console.error("Account deletion error:", error);
    return NextResponse.json({ error: "Failed to delete account" }, { status: 500 });
  }
}
