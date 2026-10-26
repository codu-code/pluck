import type { MetadataRoute } from "next";
import { POSTS } from "@/lib/blog";

const base = process.env.BETTER_AUTH_URL ?? "http://localhost:3000";

// The marketing pages and the blog. Public Lists are left to links: they are people's pages, not ours to list.
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    ...["", "/connect", "/open-source", "/iphone", "/chrome", "/support", "/privacy", "/terms", "/blog"].map((path) => ({ url: `${base}${path}` })),
    ...POSTS.map((p) => ({ url: `${base}/blog/${p.slug}`, lastModified: p.date })),
  ];
}
