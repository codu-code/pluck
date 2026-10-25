import type { MetadataRoute } from "next";

const base = process.env.BETTER_AUTH_URL ?? "http://localhost:3000";

// The marketing pages and public Lists are for search engines; a signed-in library, sign-in and the API are not.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/inbox", "/later", "/archive", "/search", "/lists", "/items", "/settings", "/admin", "/shared", "/copy", "/signin", "/oauth", "/mcp", "/extension", "/d/", "/try", "/offline"],
    },
    sitemap: `${base}/sitemap.xml`,
  };
}
