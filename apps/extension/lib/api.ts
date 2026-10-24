import { createClient } from "@pluck/client";
import { authHeader } from "./auth";
import { set, settings } from "./store";

export { Refused, SignedOut, Unreachable } from "@pluck/client";

export const api = createClient({
  server: async () => (await settings()).server,
  auth: authHeader,
  onSignedOut: () => set({ tokens: null, email: null }),
});

export const openInPluck = async (path: string) => browser.tabs.create({ url: `${(await settings()).server}${path}` });
