"use client";

import { useEffect } from "react";
import { CONSENT_EVENT, identify } from "@/lib/analytics";

// Ties usage to the signed-in account, only once they said yes (lib/analytics.ts decides).
export function AnalyticsUser({ id }: { id: string }) {
  useEffect(() => {
    const tie = () => identify(id);
    tie();
    window.addEventListener(CONSENT_EVENT, tie);
    return () => window.removeEventListener(CONSENT_EVENT, tie);
  }, [id]);
  return null;
}
