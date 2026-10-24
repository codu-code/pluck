import { json, route } from "@/lib/api";
import { exportList } from "@/lib/library";

// JSON with a markdown field; ?format=md returns the Markdown as a file.
export const GET = route<{ id: string }>({ kind: "read" }, async ({ req, caller, params }) => {
  const out = await exportList(caller.userId, params.id);
  if (new URL(req.url).searchParams.get("format") !== "md") return json(out);
  return new Response(out.markdown, {
    headers: { "content-type": "text/markdown; charset=utf-8", "content-disposition": `attachment; filename="${out.list.slug}.md"` },
  });
});
