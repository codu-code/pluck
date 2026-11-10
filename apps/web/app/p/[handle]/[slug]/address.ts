import { ORIGIN } from "@/lib/origin";

// A public List's address, from the route's params: they can arrive percent-encoded or not (see publicPage).
export function listAddress(handle: string, slug: string): string {
  const part = (s: string) => {
    try {
      return encodeURIComponent(decodeURIComponent(s));
    } catch {
      return encodeURIComponent(s);
    }
  };
  return `${ORIGIN}/@${part(handle)}/${part(slug)}`;
}
