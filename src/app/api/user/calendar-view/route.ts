import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { calendarViewSchema } from "@/lib/validations/task";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: { defaultCalendarView: true },
    });

    const view = user?.defaultCalendarView && ["month", "week", "day", "agenda"].includes(user.defaultCalendarView)
      ? user.defaultCalendarView
      : "month";

    return NextResponse.json({ defaultCalendarView: view });
  } catch (error) {
    console.error("Fetch calendar view error:", error);
    return NextResponse.json({ error: "Failed to fetch default calendar view" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const parsed = calendarViewSchema.safeParse(body?.defaultCalendarView);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid calendar view mode. Allowed: month, week, day, agenda." },
        { status: 400 }
      );
    }

    const defaultCalendarView = parsed.data;

    const updatedUser = await db.user.update({
      where: { id: session.user.id },
      data: { defaultCalendarView },
      select: { id: true, defaultCalendarView: true },
    });

    return NextResponse.json({ success: true, user: updatedUser });
  } catch (error) {
    console.error("Update calendar view error:", error);
    return NextResponse.json({ error: "Failed to update default calendar view" }, { status: 500 });
  }
}
