// The caller's address, for rate limits. Our proxy (Vercel, or the self-host reverse proxy) appends the address it
// saw last; anything to the left of it came from the client and can be made up.
export function clientIp({ headers }: { headers: Headers }): string {
  return headers.get("x-forwarded-for")?.split(",").at(-1)?.trim() || headers.get("x-real-ip") || "local";
}
