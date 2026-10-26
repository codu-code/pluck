import { afterEach, expect, test, vi } from "vitest";
import { POSTS } from "./blog";
import { announceNewPosts, INDEXNOW_KEY } from "./indexnow";

afterEach(() => vi.unstubAllGlobals());

test("a new post is announced once, in every language, and only by getpluck.io", async () => {
  const sent = vi.fn(async (_url: string, _init: RequestInit) => new Response(null, { status: 202 }));
  vi.stubGlobal("fetch", sent);
  const post = POSTS[0]!;
  const day = new Date(`${post.date}T12:00:00Z`);

  expect(await announceNewPosts(day, "https://pluck.example.org")).toBe(0); // a self-hosted copy stays quiet
  expect(await announceNewPosts(new Date(day.getTime() + 10 * 86_400_000), "https://getpluck.io")).toBe(0); // old news
  const count = await announceNewPosts(day, "https://getpluck.io");
  expect(count % 10).toBe(0);
  const body = JSON.parse(String(sent.mock.calls[0]![1].body)) as { host: string; key: string; urlList: string[] };
  expect(body).toMatchObject({ host: "getpluck.io", key: INDEXNOW_KEY });
  expect(body.urlList).toContain(`https://getpluck.io/blog/${post.slug}`);
  expect(body.urlList).toContain(`https://getpluck.io/zh-hans/blog/${post.slug}`);
  expect(await announceNewPosts(day, "https://getpluck.io")).toBe(0); // claimed: never twice
  expect(sent).toHaveBeenCalledTimes(1);
});
