import { findPost } from "@/lib/blog";
import { og, OG_SIZE } from "@/lib/og";

export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "A post on the Pluck blog";

// A post's link preview: its title and its one-line description, on the forest ground.
export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const post = findPost((await params).slug);
  return og({ title: post?.title ?? "Pluck", sub: post?.description, foot: "getpluck.io/blog" });
}
