"use client";

import { useRouter } from "next/navigation";
import { useCallback, useRef } from "react";
import { TopBar, type PluckDraft } from "@/components/TopBar";

export function AddShared({ text }: { text: string }) {
  const router = useRouter();
  // The box also sends what waited offline: only the pluck made here goes on to the Inbox.
  const mine = useRef<string | null>(null);
  const onPluck = useCallback((d: PluckDraft) => void (mine.current = d.key), []);
  const onPlucked = useCallback((key: string) => void (key === mine.current && router.replace("/inbox")), [router]);
  return <TopBar sample={text} emphasis onPluck={onPluck} onPlucked={onPlucked} />;
}
