// This copy's own address: getpluck.io hosted, a self-hoster's domain otherwise. HOST is how the UI shows it.
// Its own file, with no imports, so the site, the share images and instrumentation can read it without loading auth.
export const ORIGIN = process.env.BETTER_AUTH_URL ?? "http://localhost:3000";
export const HOST = new URL(ORIGIN).host;
