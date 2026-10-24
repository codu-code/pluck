import { forgetUser } from "./analytics";

// Signing out (or deleting the account) leaves nothing behind in this browser: the offline page cache
// and any plucks waiting to sync go too.
export async function signOutHere(): Promise<void> {
  await fetch("/api/auth/sign-out", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" }).catch(() => {});
  await clearLocal();
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
