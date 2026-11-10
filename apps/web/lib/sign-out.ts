import { forgetUser } from "./analytics";

// Signing out (or deleting the account) leaves nothing behind in this browser: the offline page cache
// and any plucks waiting to sync go too. False when the server did not hear it: the session cookie is
// HttpOnly, so only the server can end it, and until it does this browser is still signed in.
export async function signOutHere(): Promise<boolean> {
  const res = await fetch("/api/auth/sign-out", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" }).catch(() => null);
  if (!res?.ok) return false;
  await clearLocal();
  return true;
}

export async function clearLocal(): Promise<void> {
  forgetUser();
  try {
    localStorage.removeItem("pluck:queue");
  } catch {
    // storage blocked: nothing to clear
  }
  if ("caches" in window) await Promise.all((await caches.keys()).map((k) => caches.delete(k)));
}
