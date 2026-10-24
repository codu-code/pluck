import type { CreateItemBody } from "@pluck/shared-schemas";
import { Refused } from "./api";

// Plucks made with no connection wait here (persisted on the device) and go up when it is next online.
export type Queued = { id?: string; body: CreateItemBody; at: number };
export type QueueStore = { read(): Promise<Queued[]>; write(q: Queued[]): Promise<void> };

const keyOf = (q: Queued) => q.id ?? String(q.at); // entries queued before ids existed go by their time

export function createQueue(store: QueueStore) {
  let draining: Promise<number> | null = null;
  return {
    count: async () => (await store.read()).length,
    add: async (body: CreateItemBody, now = Date.now()) => {
      const q = [...(await store.read()), { id: `${now}-${Math.random().toString(36).slice(2, 10)}`, body, at: now }];
      await store.write(q);
      return q.length;
    },
    // Sends in order, one at a time. An entry leaves the queue once it is sent, or refused (retrying will not change
    // that), by writing back a fresh read, so plucks queued meanwhile stay. The first one that cannot be sent stops
    // the drain: the rest would fail the same way. One drain runs at a time; a second call gets the first's result.
    drain: (send: (body: CreateItemBody) => Promise<unknown>): Promise<number> =>
      (draining ??= (async () => {
        try {
          for (const q of await store.read()) {
            try {
              await send(q.body);
            } catch (e) {
              if (!(e instanceof Refused)) break;
            }
            await store.write((await store.read()).filter((x) => keyOf(x) !== keyOf(q)));
          }
          return (await store.read()).length;
        } finally {
          draining = null;
        }
      })()),
  };
}
