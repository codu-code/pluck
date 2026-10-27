import type { CreateItemBody } from "@pluck/shared-schemas";
import { Refused } from "./api";

// Plucks made with no connection wait here (persisted on the device) and go up when it is next online.
export type Queued = { id?: string; body: CreateItemBody; at: number };
export type QueueStore = { read(): Promise<Queued[]>; write(q: Queued[]): Promise<void> };

const keyOf = (q: Queued) => q.id ?? String(q.at); // entries queued before ids existed go by their time

// The rules for everything waiting on a device, whatever holds it. Sends in order, one at a time. An entry leaves once
// it is sent, or refused (retrying will not change that). Anything else (offline, signed out, busy, down) keeps it and
// stops the drain: the rest would fail the same way. One drain runs at a time; a second call gets the first's result.
export function createDrain<E>(store: { read(): Promise<E[]>; remove(e: E): Promise<void> }) {
  let draining: Promise<number> | null = null;
  return (send: (e: E) => Promise<unknown>): Promise<number> =>
    (draining ??= (async () => {
      try {
        for (const e of await store.read()) {
          try {
            await send(e);
          } catch (err) {
            if (!(err instanceof Refused)) break;
          }
          await store.remove(e);
        }
        return (await store.read()).length;
      } finally {
        draining = null;
      }
    })());
}

export function createQueue(store: QueueStore) {
  // Removing writes back a fresh read, so plucks queued meanwhile stay.
  const drain = createDrain<Queued>({ read: store.read, remove: async (q) => store.write((await store.read()).filter((x) => keyOf(x) !== keyOf(q))) });
  return {
    count: async () => (await store.read()).length,
    add: async (body: CreateItemBody, id = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`) => {
      const q = [...(await store.read()), { id, body, at: Date.now() }];
      await store.write(q);
      return q.length;
    },
    drain: (send: (body: CreateItemBody, q: Queued) => Promise<unknown>) =>
      drain((q) => send(q.id ? { ...q.body, clientKey: q.id } : q.body, q)), // the key makes a resend safe
  };
}
