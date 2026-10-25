import type { MetadataRoute } from "next";

const base = process.env.BETTER_AUTH_URL ?? "http://localhost:3000";

// The marketing pages. Public Lists are left to links: they are people's pages, not ours to list.
export default function sitemap(): MetadataRoute.Sitemap {
  return ["", "/connect", "/open-source", "/iphone", "/chrome", "/support", "/privacy", "/terms"].map((path) => ({ url: `${base}${path}` }));
}
