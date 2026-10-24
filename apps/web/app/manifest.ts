import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Pluck",
    short_name: "Pluck",
    description: "Pluck it. A fast, open-source URL saver your AI can read.",
    start_url: "/inbox",
    display: "standalone",
    background_color: "#F6F8F4",
    theme_color: "#1E5C45",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
    ],
  };
}
