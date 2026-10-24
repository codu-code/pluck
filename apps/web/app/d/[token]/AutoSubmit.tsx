"use client";

import { useEffect } from "react";

// One tap for a person in a browser; nothing for a link scanner that never runs scripts.
export function AutoSubmit({ formId }: { formId: string }) {
  useEffect(() => {
    (document.getElementById(formId) as HTMLFormElement | null)?.requestSubmit();
  }, [formId]);
  return null;
}
