import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { hashToken } from "@/lib/token";
import { InvitationStatus } from "@prisma/client";
import Link from "next/link";
import { AcceptInviteButton } from "./accept-invite-button";
import { Users, AlertTriangle, ShieldCheck, LogIn, UserPlus } from "lucide-react";

export const metadata = {
  title: "Team Invitation — TheWork STUDIO",
  description: "Accept an invitation to join a team.",
};

export default async function InviteAcceptancePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const hashed = hashToken(token);

  const invitation = await db.teamInvitation.findUnique({
    where: { tokenHash: hashed },
    include: {
      team: { select: { id: true, name: true } },
      invitedBy: { select: { name: true, email: true } },
    },
  });

  if (!invitation) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center p-4">
        <div className="w-full max-w-md rounded-2xl border border-red-200 dark:border-red-900 bg-white dark:bg-zinc-900 p-8 text-center space-y-4 shadow-sm">
          <AlertTriangle className="mx-auto h-12 w-12 text-red-500" />
          <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
            Invalid Invitation Link
          </h1>
          <p className="text-sm text-zinc-500">
            This invitation link is not valid or has been revoked. Please ask the team admin to send you a new invitation.
          </p>
          <Link
            href="/"
            className="inline-block rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white"
          >
            Back to Home
          </Link>
        </div>
      </div>
    );
  }

  const isExpired = new Date() > invitation.expiresAt || invitation.status === InvitationStatus.EXPIRED;
  const isUsed = invitation.status === InvitationStatus.ACCEPTED;
  const isRevoked = invitation.status === InvitationStatus.REVOKED;

  if (isExpired || isUsed || isRevoked) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center p-4">
        <div className="w-full max-w-md rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-8 text-center space-y-4 shadow-sm">
          <AlertTriangle className="mx-auto h-12 w-12 text-amber-500" />
          <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
            {isUsed ? "Invitation Already Used" : isRevoked ? "Invitation Revoked" : "Invitation Expired"}
          </h1>
          <p className="text-sm text-zinc-500">
            {isUsed
              ? "This single-use invitation has already been accepted."
              : isRevoked
              ? "This invitation has been revoked by the Master Admin."
              : "This invitation link has expired (7-day validity limit)."}
          </p>
          <Link
            href="/"
            className="inline-block rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white"
          >
            Back to Home
          </Link>
        </div>
      </div>
    );
  }

  const session = await auth();
  const currentUrl = `/invite/${token}`;

  return (
    <div className="flex min-h-[75vh] items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-8 space-y-6 shadow-md text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-100 dark:bg-blue-950/60 text-blue-600">
          <Users className="h-7 w-7" />
        </div>

        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            You&apos;re Invited!
          </h1>
          <p className="text-sm text-zinc-500">
            {invitation.invitedBy.name || invitation.invitedBy.email} has invited you to join
          </p>
          <div className="pt-2">
            <span className="text-xl font-extrabold text-blue-600 dark:text-blue-400">
              {invitation.team.name}
            </span>
          </div>
        </div>

        <div className="rounded-xl border border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/40 p-4 text-xs space-y-2 text-left">
          <div className="flex justify-between">
            <span className="text-zinc-500">Role:</span>
            <span className="font-bold text-zinc-800 dark:text-zinc-200">{invitation.proposedRole}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-500">Invited Email:</span>
            <span className="font-mono text-zinc-800 dark:text-zinc-200">{invitation.email}</span>
          </div>
        </div>

        {session?.user ? (
          <AcceptInviteButton token={token} />
        ) : (
          <div className="space-y-3 pt-2">
            <p className="text-xs text-zinc-500">
              Please sign in or create an account to accept this invitation:
            </p>
            <div className="flex gap-2">
              <Link
                href={`/sign-in?callbackUrl=${encodeURIComponent(currentUrl)}`}
                className="flex-1 flex items-center justify-center gap-1.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 py-2.5 text-xs font-semibold text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50"
              >
                <LogIn className="h-3.5 w-3.5" />
                <span>Sign In</span>
              </Link>
              <Link
                href={`/sign-up?callbackUrl=${encodeURIComponent(currentUrl)}`}
                className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-blue-600 py-2.5 text-xs font-semibold text-white hover:bg-blue-700 shadow-sm"
              >
                <UserPlus className="h-3.5 w-3.5" />
                <span>Sign Up</span>
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
