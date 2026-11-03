"use client";

import type { ConsentAnswer } from "@pluck/shared-schemas";
import { useEffect } from "react";
import { CONSENT_EVENT, identify, readAnswer, setConsent } from "@/lib/analytics";

// Gives the account this browser's answer. Signed out it is refused, and the next signed-in page catches up.
export const saveAnswer = (a: ConsentAnswer) =>
  void fetch("/api/v1/me", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ settings: { analytics: a.answer, analyticsAt: a.at } }) }).catch(() => null);

// One answer for the whole account (settings.analytics), so the server knows it too. The newest answer wins: this
// browser takes the account's when that is newer, and gives the account its own when that is (answered while signed
// out, or a save that failed). Ties usage to the account only once they said yes (lib/analytics.ts decides).
export function AnalyticsUser({ id, answer }: { id: string; answer: ConsentAnswer | null }) {
  useEffect(() => {
    const local = readAnswer();
    if (local && local.at > (answer?.at ?? -1)) saveAnswer(local);
    else if (answer && answer.at > (local?.at ?? -1)) setConsent(answer.answer, answer.at);
    const sync = () => identify(id);
    sync();
    window.addEventListener(CONSENT_EVENT, sync);
    return () => window.removeEventListener(CONSENT_EVENT, sync);
  }, [id, answer]);
  return null;
}
