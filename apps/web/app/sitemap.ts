import { LOCALES } from "@pluck/i18n";
import type { MetadataRoute } from "next";
import { POSTS } from "@/lib/blog";
import { localePath, SITE_PAGES } from "@/lib/siteUrls";

const base = process.env.BETTER_AUTH_URL ?? "http://localhost:3000";

// The marketing pages and the blog, each in every language, with each URL naming its other languages (hreflang).
// Public Lists are left to links: they are people's pages, not ours to list.
export default function sitemap(): MetadataRoute.Sitemap {
  const page = (path: string, lastModified?: string) => {
    const languages = Object.fromEntries(LOCALES.map((l) => [l, `${base}${localePath(l, path)}`]));
    return LOCALES.map((l) => ({ url: `${base}${localePath(l, path)}`, lastModified, alternates: { languages: { ...languages, "x-default": `${base}${path}` } } }));
  };
  return [...SITE_PAGES.flatMap((path) => page(path)), ...POSTS.flatMap((p) => page(`/blog/${p.slug}`, p.date))];
}
