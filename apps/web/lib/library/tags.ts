import { countAiTagged, createTag, deleteTag, listTags, nearestTags, purgeAiTags, renameTag, resolveTags } from "@pluck/db";
import type { Tag } from "@pluck/shared-schemas";
import { ApiError } from "../errors";

export type Actor = "user" | "mcp";

// Tag ids, or names of existing tags. Anything else is a 422 with the nearest tags; nothing is created here.
export async function tagIdsFor(userId: string, refs: string[]): Promise<string[]> {
  const { ids, unknown } = await resolveTags(userId, refs);
  if (unknown.length) {
    throw new ApiError("unknown_tags", `No tag called ${unknown.map((u) => `"${u}"`).join(", ")}. Use an existing tag, or create one first.`, 422, {
      unknown,
      nearest: await nearestTags(userId, unknown[0]!),
    });
  }
  return ids;
}

export const tagsOf = (userId: string): Promise<Tag[]> => listTags(userId);

export async function addTag(userId: string, name: string, { by = "user" }: { by?: Actor } = {}): Promise<{ tag: Tag; created: boolean }> {
  const res = await createTag(userId, name, by);
  if (!res) throw new ApiError("bad_request", "A tag needs at least one letter or number.", 400);
  return res;
}

export async function renameTagFor(userId: string, id: string, name: string): Promise<Tag> {
  const res = await renameTag(userId, id, name);
  if (res === "conflict") throw new ApiError("conflict", `There is already a tag called "${name}". Merge them instead.`, 409);
  if (!res) throw new ApiError("not_found", "No such tag.", 404);
  return res;
}

export async function removeTag(userId: string, id: string, opts: { reassignTo: string } | { removeFromItems: true }): Promise<void> {
  if (!(await deleteTag(userId, id, opts))) throw new ApiError("not_found", "No such tag, or no tag to merge into.", 404);
}

export const purgeAi = (userId: string, days: number) => purgeAiTags(userId, days);
export const aiTaggedCount = (userId: string, days: number) => countAiTagged(userId, days);
