import { getTranslations } from "next-intl/server";
import { og, OG_SIZE } from "@/lib/og";

export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "Pluck";

export default async function Image() {
  const t = await getTranslations("site");
  return og({ title: t.raw("connect.title") as string, sub: t("connect.meta.description") });
}
