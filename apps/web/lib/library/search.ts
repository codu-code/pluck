import { searchItems } from "@pluck/db";
import type { SearchQuery, SearchResults } from "@pluck/shared-schemas";

// Text search, no vectors: "by meaning" is your AI's job through the connector.
export const search = (userId: string, q: SearchQuery): Promise<SearchResults> => searchItems(userId, q);

