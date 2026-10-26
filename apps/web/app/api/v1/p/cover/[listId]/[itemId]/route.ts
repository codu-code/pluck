import { publicRoute } from "@/lib/api";
import { publicCover } from "@/lib/library";

// A cover on a public page: only for an item on a live public list.
export const GET = publicRoute<{ listId: string; itemId: string }>("public-cover", 600, async ({ params }) =>
  new Response(null, { status: 302, headers: { location: await publicCover(params.listId, params.itemId), "cache-control": "public, max-age=300" } }),
);
