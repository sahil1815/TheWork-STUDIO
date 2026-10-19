"use client";

import { useEffect, useRef } from "react";
import { useSession } from "next-auth/react";

export function TimeZoneDetector() {
  const { data: session, update } = useSession();
  const hasSyncedRef = useRef(false);

  useEffect(() => {
    if (!session?.user?.id || hasSyncedRef.current) return;

    try {
      const detectedTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const currentSavedTimeZone = session.user.timeZone;

      if (detectedTimeZone && detectedTimeZone !== currentSavedTimeZone) {
        hasSyncedRef.current = true;
        fetch("/api/user/timezone", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ timeZone: detectedTimeZone }),
        })
          .then((res) => {
            if (res.ok) {
              update({ timeZone: detectedTimeZone });
            }
          })
          .catch((err) => {
            console.error("Failed to auto-sync detected timezone:", err);
          });
      }
    } catch (e) {
      console.warn("Browser does not support Intl.DateTimeFormat timezone detection:", e);
    }
  }, [session, update]);

  return null;
}
