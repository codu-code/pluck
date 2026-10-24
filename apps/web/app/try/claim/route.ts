import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { claimPaste } from "@/lib/library";
import { TRY_COOKIE, tryToken } from "@/lib/api";

// Where the sign-in link lands when the visitor pasted links on the home page first: they become theirs.
export async function GET(req: Request) {
  const origin = process.env.BETTER_AUTH_URL ?? new URL(req.url).origin; // the public origin, where the session cookie lives
  const user = await currentUser();
  if (!user) return NextResponse.redirect(`${origin}/signin`);
  const token = tryToken(req.headers.get("cookie"));
  if (token) await claimPaste(user.id, token);
  const res = NextResponse.redirect(`${origin}/inbox`);
  res.cookies.delete(TRY_COOKIE);
  return res;
}
