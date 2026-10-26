import { after, NextResponse } from "next/server";
import { currentUser, ORIGIN } from "@/lib/auth";
import { claimPaste } from "@/lib/library";
import { TRY_COOKIE, tryToken } from "@/lib/api";

// Where the sign-in link lands when the visitor pasted links on the home page first: they become theirs.
export async function GET(req: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.redirect(`${ORIGIN}/signin`);
  const token = tryToken(req.headers.get("cookie"));
  if (token) await claimPaste(user.id, token, { defer: after }); // the pages are read after the redirect
  const res = NextResponse.redirect(`${ORIGIN}/inbox`);
  res.cookies.delete(TRY_COOKIE);
  return res;
}
