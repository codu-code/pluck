import { json, publicRoute } from "@/lib/api";
import { ApiError } from "@/lib/errors";
import { publicPage } from "@/lib/library";

// Public list data, no auth, cached 60 s at the edge. The page at /@handle/slug counts views; this does not.
export const GET = publicRoute<{ handle: string; slug: string }>("public-list", 300, async ({ params }) => {
  const page = await publicPage(params.handle, params.slug, { count: false }).catch(() => null);
  if (!page) throw new ApiError("not_found", "No such list.", 404);
  return json(page, 200, { "cache-control": "public, s-maxage=60, stale-while-revalidate=60" });
});
