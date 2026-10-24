"use client";

import { standaloneStyles as s } from "@/components/Standalone";

export function Retry() {
  return <button type="button" className={s.primary} onClick={() => location.reload()}>Try again</button>;
}
