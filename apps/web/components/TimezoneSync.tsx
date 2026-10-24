"use client";

import { useEffect } from "react";

// Expiry runs at 02:00 and the digest at 06:00 in the person's own time: keep their timezone current.
export function TimezoneSync({ current }: { current: string }) {
  useEffect(() => {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz && tz !== current)
      void fetch("/api/v1/me", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ settings: { timezone: tz } }) });
  }, [current]);
  return null;
}
