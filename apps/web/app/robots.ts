import type { MetadataRoute } from "next";
import { ORIGIN } from "@/lib/origin";

const base = ORIGIN;
// Built per request: a Docker image is built with a placeholder address, and this names the one it runs at.
export const dynamic = "force-dynamic";

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
