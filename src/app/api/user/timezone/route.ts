import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

const timeZoneSchema = z.object({
  timeZone: z.string().min(1),
});

export async function PATCH(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const parsed = timeZoneSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid timezone" }, { status: 400 });
    }

    const { timeZone } = parsed.data;

    // Validate IANA timezone
    try {
      Intl.DateTimeFormat(undefined, { timeZone });
    } catch {
      return NextResponse.json({ error: "Invalid IANA timezone identifier" }, { status: 400 });
    }

    const updatedUser = await db.user.update({
      where: { id: session.user.id },
      data: { timeZone },
      select: { id: true, timeZone: true },
    });

    return NextResponse.json({ success: true, user: updatedUser });
  } catch (error) {
    console.error("Timezone update error:", error);
    return NextResponse.json({ error: "Failed to update timezone" }, { status: 500 });
  }
}
