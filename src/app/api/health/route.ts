import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const startTime = Date.now();
  let dbStatus = "healthy";
  let dbError: string | null = null;

  try {
    await db.$queryRaw`SELECT 1`;
  } catch (err: unknown) {
    dbStatus = "unreachable";
    dbError = err instanceof Error ? err.message : "Unknown database error";
  }

  const responseTimeMs = Date.now() - startTime;
  const isHealthy = dbStatus === "healthy";

  return NextResponse.json(
    {
      status: isHealthy ? "ok" : "degraded",
      timestamp: new Date().toISOString(),
      database: {
        status: dbStatus,
        error: dbError,
      },
      responseTimeMs,
    },
    { status: isHealthy ? 200 : 503 }
  );
}
