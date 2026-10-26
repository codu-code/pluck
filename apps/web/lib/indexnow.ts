import { claimOnce } from "@pluck/db";
import { LOCALES } from "@pluck/i18n";
import { POSTS } from "./blog";
import { log } from "./log";
import { ORIGIN } from "./origin";
import { localePath } from "./siteUrls";

// IndexNow (indexnow.org): a new post is announced to Bing (and Yandex, Seznam, Naver) in all ten languages as soon
// as it is out, instead of waiting for a crawl. Only getpluck.io announces; the protocol checks the key against the
// file of the same name at the site's root (public/<key>.txt).
export const INDEXNOW_KEY = "2a2940bd0ceed62a1fd5c0a15b0b5836";
const HOSTED = "https://getpluck.io";
// A post counts as new for three days from its date, and its claim lasts seven (meta's expiry), so it goes once.
const NEW_FOR_MS = 3 * 86_400_000;

export async function announceNewPosts(now = new Date(), origin = ORIGIN): Promise<number> {
  if (origin !== HOSTED) return 0;
  const since = new Date(now.getTime() - NEW_FOR_MS).toISOString().slice(0, 10);
  const urlList: string[] = [];
  for (const p of POSTS) {
    if (p.date >= since && (await claimOnce(`indexnow:${p.slug}`))) urlList.push(...LOCALES.map((l) => origin + localePath(l, `/blog/${p.slug}`)));
  }
  if (!urlList.length) return 0;
  // A failed announcement is not retried: the sitemap still lists the post, so it is only found later.
  const res = await fetch("https://api.indexnow.org/indexnow", {
    method: "POST",
    headers: { "content-type": "application/json; charset=utf-8" },
    body: JSON.stringify({ host: new URL(origin).host, key: INDEXNOW_KEY, keyLocation: `${origin}/${INDEXNOW_KEY}.txt`, urlList }),
    signal: AbortSignal.timeout(5_000),
  }).catch((e: unknown) => (log("warn", "indexnow failed", { error: e }), null));
  if (res && !res.ok) log("warn", "indexnow refused", { status: res.status });
  return urlList.length;
}
