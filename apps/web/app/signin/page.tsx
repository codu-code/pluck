import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { TRY_COOKIE } from "@/lib/api";
import { currentUser } from "@/lib/auth";
import { SignInForm } from "./SignInForm";

export const metadata: Metadata = { title: "Sign in · Pluck" };

// Only same-site paths, so a crafted link cannot bounce people elsewhere after sign-in.
const safeNext = (n?: string) => (n && n.startsWith("/") && !n.startsWith("//") ? n : "/inbox");

// Sent here by the OAuth provider (an AI tool connecting): after the email link signs you in, carry on
// with the same authorization request. The signing fields only matter to this page, so they are dropped.
function oauthResume(params: Record<string, string | string[] | undefined>): string | null {
  if (!params.sig || !params.client_id) return null;
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (["sig", "exp", "next"].includes(k) || k.startsWith("ba_") || v === undefined) continue;
    for (const x of Array.isArray(v) ? v : [v]) q.append(k, x);
  }
  return `/api/auth/oauth2/authorize?${q}`;
}

export default async function SignIn({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const asked = oauthResume(params) ?? safeNext(typeof params.next === "string" ? params.next : undefined);
  // Links pasted on the home page before signing up come along: the email link lands on the claim first.
  const next = asked === "/inbox" && (await cookies()).has(TRY_COOKIE) ? "/try/claim" : asked;
  if (await currentUser()) redirect(next);
  return <SignInForm next={next} forAiTool={Boolean(params.sig && params.client_id)} />;
}
