import { mongodbAdapter } from "better-auth/adapters/mongodb";
import { getClient, getDb } from "./client.ts";

// Better Auth stores its rows in the pluck database through this adapter, so the Mongo handle stays inside packages/db.
export function authAdapter() {
  return mongodbAdapter(getDb(), { client: getClient() });
}
