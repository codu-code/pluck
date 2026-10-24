import { afterAll } from "vitest";

// Tests read the same .env as the app (blob credentials, fixture access), then override the database.
try {
  process.loadEnvFile(".env");
} catch {}

// Every test file gets a throwaway database on the dev Mongo, dropped when the file finishes.
const name = `pluck_test_${process.pid}_${Math.random().toString(36).slice(2, 8)}`;
process.env.MONGODB_URI = `mongodb://127.0.0.1:27027/${name}?replicaSet=rs0&directConnection=true`;

afterAll(async () => {
  const { dropTestDatabase } = await import("@pluck/db/testing");
  await dropTestDatabase();
});
