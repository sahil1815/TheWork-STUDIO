"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { acceptTeamInvitation } from "@/actions/team-actions";
import { Check, Loader2 } from "lucide-react";

export function AcceptInviteButton({ token }: { token: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAccept = async () => {
    setLoading(true);
    setError(null);

    const res = await acceptTeamInvitation(token);

    if (res.success && res.teamId) {
      router.push(`/teams/${res.teamId}`);
      router.refresh();
    } else {
      setError(res.error || "Failed to accept invitation");
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      {error && (
        <div className="rounded-lg bg-red-50 dark:bg-red-950/40 p-3 text-xs text-red-700 dark:text-red-300 border border-red-200 dark:border-red-900">
          {error}
        </div>
      )}

      <button
        onClick={handleAccept}
        disabled={loading}
        className="w-full flex items-center justify-center gap-2 rounded-xl bg-blue-600 py-3 text-sm font-bold text-white shadow-md hover:bg-blue-700 disabled:opacity-50 transition"
      >
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Joining team...</span>
          </>
        ) : (
          <>
            <Check className="h-4 w-4" />
            <span>Accept Invitation & Join Team</span>
          </>
        )}
      </button>
    </div>
  );
}
