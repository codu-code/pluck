import { getTranslations } from "next-intl/server";
import { publicPage } from "@/lib/library";
import { og, OG_SIZE } from "@/lib/og";

export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "A List on Pluck";

// A public List's link preview, on the light ground: its name, purpose, who made it and how many things.
export default async function Image({ params }: { params: Promise<{ handle: string; slug: string }> }) {
  const { handle, slug } = await params;
  const page = await publicPage(handle, slug, { count: false });
  const t = await getTranslations("site");
  if (!page) return og({ title: "Pluck" });
  const by = page.author.name ?? `@${page.author.handle}`;
  return og({ title: page.list.name, sub: page.list.purpose || undefined, foot: t("publicList.og", { by, count: page.list.itemCount }), tone: "light" });
}
