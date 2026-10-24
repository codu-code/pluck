import Storage from "expo-sqlite/kv-store";

// Small persisted values on the phone (SQLite key-value): the save queue, client registrations, the query cache.
export const kv = {
  get: async <T>(key: string, fallback: T): Promise<T> => {
    const raw = await Storage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  },
  set: (key: string, value: unknown) => Storage.setItem(key, JSON.stringify(value)),
  remove: (key: string) => Storage.removeItem(key),
  storage: Storage, // for the query persister
};
