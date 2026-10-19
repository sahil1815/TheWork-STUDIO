import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

const registerSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  timeZone: z.string().optional().default("UTC"),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = registerSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { name, email, password, timeZone } = parsed.data;
    const normalizedEmail = email.toLowerCase().trim();

    const existingUser = await db.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "An account with this email already exists" },
        { status: 409 }
      );
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await db.user.create({
      data: {
        name,
        email: normalizedEmail,
        passwordHash,
        timeZone: timeZone || "UTC",
        reminderPreference: {
          create: {
            defaultOffsets: [4320, 1440, 0],
            enabled: true,
          },
        },
      },
      select: {
        id: true,
        name: true,
        email: true,
        timeZone: true,
      },
    });

    return NextResponse.json({ success: true, user }, { status: 201 });
  } catch (error) {
    console.error("Sign-up error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred during registration" },
      { status: 500 }
    );
  }
}
