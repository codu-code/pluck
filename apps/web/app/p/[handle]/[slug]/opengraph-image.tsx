import { getTranslations } from "next-intl/server";
import { ImageResponse } from "next/og";
import { publicPage } from "@/lib/library";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// A clean card for link previews: the list's name, purpose, author and count on the Pluck ground.
export default async function OgImage({ params }: { params: Promise<{ handle: string; slug: string }> }) {
  const { handle, slug } = await params;
  const page = await publicPage(handle, slug, { count: false });
  const t = await getTranslations("site.publicList");
  const name = page?.list.name ?? "Pluck";
  const purpose = page?.list.purpose ?? "";
  const by = page ? (page.author.name ?? `@${page.author.handle}`) : "";
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 72, background: "#F6F8F4", color: "#151A13" }}>
        <div style={{ display: "flex", fontSize: 40, fontWeight: 700, color: "#1E5C45" }}>pluck</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ display: "flex", fontSize: 72, fontWeight: 700, lineHeight: 1.05, letterSpacing: -2 }}>{name}</div>
          {purpose && <div style={{ display: "flex", fontSize: 34, color: "#394034" }}>{purpose}</div>}
        </div>
        <div style={{ display: "flex", fontSize: 28, color: "#525A4E" }}>
          {page ? t("og", { by, count: page.list.itemCount }) : ""}
        </div>
      </div>
    ),
    size,
  );
}
