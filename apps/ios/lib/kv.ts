import Storage from "expo-sqlite/kv-store";

// Small persisted values on the phone (SQLite key-value): the save queue, client registrations, the query cache, the
// Items kept for offline reading.
export const kv = {
  get: async <T>(key: string, fallback: T): Promise<T> => {
    const raw = await Storage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  },
  // For a first paint that cannot wait (the reader opening an Item kept for offline reading).
  getSync: <T>(key: string, fallback: T): T => {
    const raw = Storage.getItemSync(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  },
  set: (key: string, value: unknown) => Storage.setItem(key, JSON.stringify(value)),
  remove: (key: string) => Storage.removeItem(key),
  storage: Storage, // for the query persister
};
