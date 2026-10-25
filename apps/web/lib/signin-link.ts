// Sign-in links go through a page of our own before Better Auth's verify URL, which spends the token on
// the first GET. Mail scanners (Safe Links, Mimecast, Proofpoint) fetch every link before the person does, so
// the email points at /signin/link, and only a tap on its button (a form POST) reaches verify.
const PARAMS = ["token", "callbackURL", "newUserCallbackURL", "errorCallbackURL"] as const;
export type LinkParams = Partial<Record<(typeof PARAMS)[number], string>>;

const pick = (get: (k: string) => string | null | undefined): LinkParams =>
  Object.fromEntries(PARAMS.flatMap((k) => (get(k) ? [[k, get(k)!]] : [])));

// Better Auth's verify URL, as sent to sendMagicLink, becomes the link page on the same origin.
export function linkPageUrl(verifyUrl: string): string {
  const u = new URL(verifyUrl);
  return `${u.origin}/signin/link?${new URLSearchParams(pick((k) => u.searchParams.get(k)))}`;
}

export const linkParams = (q: Record<string, string | string[] | undefined>): LinkParams => pick((k) => (typeof q[k] === "string" ? q[k] : null));

// The page's form back to verify. Only these fields, only on our own origin.
export function verifyUrl(origin: string, form: FormData): string | null {
  const p = pick((k) => { const v = form.get(k); return typeof v === "string" ? v : null; });
  return p.token ? `${origin}/api/auth/magic-link/verify?${new URLSearchParams(p)}` : null;
}
