import { searchItems } from "@pluck/db";
import type { SearchQuery, SearchResults } from "@pluck/shared-schemas";
import { track } from "../telemetry";

// Text search, no vectors: "by meaning" is your AI's job through the connector.
export async function search(userId: string, q: SearchQuery): Promise<SearchResults> {
  const res = await searchItems(userId, q);
  track(userId, "searched", { result_count: res.total }); // never the words
  return res;
}
