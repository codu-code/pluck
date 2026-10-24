// PKCE (S256) for the OAuth sign-in. The hashing is passed in, so this runs anywhere.
export const b64url = (bytes: Uint8Array) => {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

export async function pkcePair(random: (n: number) => Uint8Array, sha256: (s: string) => Promise<Uint8Array>) {
  const verifier = b64url(random(32));
  return { verifier, challenge: b64url(await sha256(verifier)), state: b64url(random(16)) };
}

// The redirect carries ?code=…&state=…; only a matching state is ours.
export function codeFrom(url: string, state: string): string | null {
  const q = url.includes("?") ? new URLSearchParams(url.slice(url.indexOf("?") + 1)) : null;
  return q && q.get("state") === state ? q.get("code") : null;
}
