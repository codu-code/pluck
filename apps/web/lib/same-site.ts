// Where a link may send someone after signing in: a path on this site and nowhere else. "/\evil.com" and "/\t/evil.com"
// are other sites to a browser (a backslash is a slash, a tab is dropped), so any backslash or control character is
// refused, and what is left must resolve to this origin.
export function samePath(next: string | undefined, fallback: string): string {
  if (!next || !/^\/(?![/\\])/.test(next) || /[\\\u0000-\u001f\u007f]/.test(next)) return fallback;
  const base = "https://pluck.invalid";
  return new URL(next, base).origin === base ? next : fallback;
}
