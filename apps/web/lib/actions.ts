import { createLibrary, sameOrigin } from "@pluck/client";
import type { Item, Status } from "@pluck/shared-schemas";

// The library actions (packages/client) over the session cookie.
export const library = createLibrary(sameOrigin());

// Whether it went through: the web's screens say "That didn't go through" whatever the error was.
export const went = (p: Promise<unknown>): Promise<boolean> => p.then(() => true, () => false);

// Status moves change the rail's counts.
const counted = async (p: Promise<unknown>) => {
  const ok = await went(p);
  if (ok) window.dispatchEvent(new Event("pluck:counts"));
  return ok;
};
export const moveItems = (ids: string[], status: Status) => counted(library.move(ids, status));
export const restoreStatuses = (items: Pick<Item, "id" | "status">[]) => counted(library.restore(items));
