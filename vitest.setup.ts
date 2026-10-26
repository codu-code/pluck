import { afterAll } from "vitest";

// Tests read the same .env as the app (blob credentials, fixture access, SMTP_URL so no email leaves the machine),
// then override the database. Without it, tests would run against whatever the shell happens to have.
try {
  process.loadEnvFile(".env");
} catch {
  throw new Error("No .env at the repo root: run `cp .env.example .env` before `pnpm test`.");
}

// Every test file gets a throwaway database on the dev Mongo, dropped when the file finishes.
const name = `pluck_test_${process.pid}_${Math.random().toString(36).slice(2, 8)}`;
process.env.MONGODB_URI = `mongodb://127.0.0.1:27027/${name}?replicaSet=rs0&directConnection=true`;

afterAll(async () => {
  const { dropTestDatabase } = await import("@pluck/db/testing");
  await dropTestDatabase();
});
