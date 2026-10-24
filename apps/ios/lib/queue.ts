import type { CreateItemBody } from "@pluck/shared-schemas";
import { Refused } from "./api";

// Plucks made with no connection wait here (persisted on the phone) and go up when the app is next online.
export type Queued = { body: CreateItemBody; at: number };
export type QueueStore = { read(): Promise<Queued[]>; write(q: Queued[]): Promise<void> };

export function createQueue(store: QueueStore) {
  return {
    count: async () => (await store.read()).length,
    add: async (body: CreateItemBody, now = Date.now()) => {
      const q = [...(await store.read()), { body, at: now }];
      await store.write(q);
      return q.length;
    },
    // Sends what it can in order. A pluck the server refuses is dropped (retrying will not change that);
    // anything else stays for next time.
    drain: async (send: (body: CreateItemBody) => Promise<unknown>) => {
      const left: Queued[] = [];
      for (const q of await store.read()) {
        try {
          await send(q.body);
        } catch (e) {
          if (!(e instanceof Refused)) left.push(q);
        }
      }
      await store.write(left);
      return left.length;
    },
  };
}
