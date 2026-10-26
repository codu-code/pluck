import { verifyUrl } from "@/lib/signin-link";
import { ORIGIN } from "@/lib/origin";


// The tap on /signin/link. 303 turns the POST into the GET that Better Auth's verify expects.
export async function POST(req: Request) {
  const to = verifyUrl(ORIGIN, await req.formData());
  return Response.redirect(to ?? `${ORIGIN}/signin`, 303);
}
