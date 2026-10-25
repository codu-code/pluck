"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Actions, Dot, Standalone, standaloneStyles as s } from "@/components/Standalone";
import { signOutHere } from "@/lib/sign-out";

// A shared link that does not open for this person: gone, taken back, or shared with another of their addresses.
export function NoAccess({ listId, email }: { listId: string; email: string }) {
  const router = useRouter();
  return (
    <Standalone
      size="md"
      title={["Not shared", <>with you<Dot /></>]}
      lede={<>Either this List no longer exists, or it isn&apos;t shared with <b>{email}</b>, the email you&apos;re signed in with. If someone sent you the link, ask them to share it with that address.</>}
    >
      <Actions>
        <Link href="/lists" className={s.primary}>Your Lists</Link>
        <button
          type="button"
          className={s.secondary}
          onClick={async () => {
            await signOutHere();
            router.push(`/signin?next=${encodeURIComponent(`/shared/${listId}`)}`);
          }}
        >
          Use another email
        </button>
      </Actions>
    </Standalone>
  );
}
