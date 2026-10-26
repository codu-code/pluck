# Previews: how Pluck reads each kind of link

A link Item opens on a Preview (GLOSSARY): Reader, Player, Post, Code, Product, Site, Document or App. The code is
`packages/extract/src/classify.ts` (what a link is, from its address and its page), `packages/extract/src/sources.ts`
(the sites whose own pages are no use to a server, and the documented route each one offers) and
`packages/shared-schemas/src/preview.ts` (the Preview values, the facts each carries, the player allowlist).

What Pluck does, in order:

1. **The address.** Players (YouTube, Vimeo, Loom, Spotify, TikTok, Instagram reels), posts (X, Threads, Bluesky, Reddit, Instagram, LinkedIn, Facebook, Hacker News, Mastodon), code (GitHub, GitLab, Codeberg, Bitbucket, gists, npm, PyPI, crates, Stack Exchange, CodePen and the like) and apps (Claude, ChatGPT, Gemini, v0, Bolt, Lovable, Perplexity, Replit, Figma, Google Docs and Drive, Notion, Canva, Miro).
2. **The source's API or oEmbed**, never a token: YouTube, Vimeo, Loom and Spotify oEmbed; for X, the JSON its own embed widget reads (`cdn.syndication.twimg.com/tweet-result`), then X's oEmbed; Reddit's oEmbed; the Hacker News, Bluesky, Mastodon, npm, PyPI, Stack Exchange and GitHub APIs. Sites marked `only` are never fetched by the server (an app shell, a bot check, or terms that forbid reading the page); what the person's browser sent (the extension, Safari's share sheet) is still read.
3. **The page's own signals:** `citation_pdf_url` (a paper's landing page), schema.org Product and Offer, `product:price:*`, Article types and `og:type=article`, a site's root or a locale root (a homepage), and too little to read (a landing page or a shell).
4. **Generic metadata is dropped:** the share titles and images some sites give every page alike.
5. **The phone's link preview.** A link shared from an app (Instagram, TikTok) comes with no page, so the share extension asks iOS's own link preview (`LPMetadataProvider`, what Messages shows). It reads the page from the person's phone, as they would see it, and its title and picture go up with the pluck. Pluck's server never asks the site.
6. **A name from the address**, never the address itself, when nothing above gave a title: "@name · TikTok", "TikTok video" (a short link, named once it is followed), "Instagram reel", "Instagram post".

Only a Reader, Code or Document keeps its body; only a Reader keeps its HTML. A Post keeps its words, a Product,
Site, App or Player what it says it is. Players load only when pressed, from an id checked against the allowlist,
on each provider's quieter domain, with the Referer YouTube requires.

Outbound links carry `utm_source=getpluck.io` as they open (`withReferral` in `urls.ts`), never in what is stored or
copied, and never on signed links.

## Open decisions

- **YouTube** wants API data refreshed within 30 days; **Spotify** and **SoundCloud** forbid keeping their content indefinitely; **Meta** (Instagram, Facebook, Threads) forbids keeping anything from its oEmbed, so Pluck keeps none of it and shows those posts from their address; a reel plays in Instagram's own embed, built from the id in its address. Since November 2025 Meta's oEmbed has no thumbnail or author, and Meta points developers at the post's own HTML metadata; the phone's link preview (step 5) is that metadata, read by the person's device. Pluck keeps the title and cover of a YouTube, Vimeo, Loom or Spotify link as every read-later app does; refreshing them when an Item is opened after 30 days is the stricter reading.
- **arXiv** asks that e-prints are not served from our own servers unless the licence allows. Save to Files on the iPhone downloads from the original first.

The research behind this, as of 2026-10-25:

Research for Pluck, 2026-10-25. How it was tested:

- Live probes ran from a residential IP in Ireland.
- Page fetches used Pluck's own Chrome 141 user agent, from `packages/extract/src/fetch.ts`.
- API and oEmbed calls used plain curl or an honest user agent.
- No crawler user agent was spoofed after the first probe (see the note in §0), and no bot check was bypassed.

Labels:

- **OBS** means seen in a live response.
- **DOC** means stated in an official doc or terms page.
- **UNVERIFIED** means neither.

Prod runs on Vercel (AWS addresses), and blocking from datacenter IPs is often worse. Amazon returned 503 to a datacenter fetch. Reddit, LinkedIn and Medium are likely to be worse from Vercel too (UNVERIFIED).

## 0. What Pluck does today, and what goes wrong

- `extract()` fetches with a Chrome UA. Every HTML page goes through Defuddle, then Readability, then meta tags.
- The kind is `video` only for youtube.com, youtu.be, vimeo.com, or when `og:type` starts with `video`. Everything else is `link` (Read).
- **Probe with Pluck's Chrome UA (OBS):**
  - Full og tags: YouTube, Vimeo, X (`x.com/jack/status/20`), LinkedIn company pages, HN (real HTML but no og tags), GitHub, Substack, arXiv, App Store, Play, Eventbrite, Luma, Wikipedia (no og:description).
  - **Empty app shell** (title only, no og tags, 1–4 words): TikTok ("TikTok - Make Your Day"), Instagram ("Instagram"), Threads ("Threads"), Reddit ("Reddit").
  - **HTTP 400:** Facebook.
  - **Cloudflare or JS challenge (403):** CodePen (page and oEmbed), npmjs.com, pypi.org project pages, stackoverflow.com, medium.com, the codesandbox.io oEmbed, lovable.dev/projects.
  - **429:** two Shopify stores. An honest `Pluck/1.0` UA got 200, so a Chrome UA that does not behave like Chrome may *hurt* there (OBS; cause UNVERIFIED).
- **Crawler UAs:** a single early probe with the `facebookexternalhit` UA got full og tags from TikTok, Instagram, Threads, Reddit and Facebook. That is impersonating another company's crawler, so **do not ship it**. The legitimate routes are oEmbed, official APIs, or metadata sent by the client.
- **Open original links:** Pluck sets `rel="noreferrer"` on them (`apps/web/app/(app)/items/[id]/Reader.tsx:228`, `page.tsx:65,85`), so publishers see no referrer from the web app (see §11).
- **Client HTML already wins in `extract()`:** the extension and the Safari share sheet send what the browser rendered. That is the only legitimate route for the sites that block servers (CodePen, npm, PyPI pages, Stack Overflow pages, Medium, Lovable). For those, the client should send `document.title` and the og tags, or the DOM, even when it sends nothing else.

## 1. Resolution order

1. **Known host, URL pattern match.** Use the source's official API or oEmbed (tables below). Most need no token.
2. **oEmbed discovery.** Look for `<link rel="alternate" type="application/json+oembed">` in the page. StackBlitz publishes oEmbed only this way; it is not in providers.json.
3. **JSON-LD, by specific type.** `Recipe`, `JobPosting`, `Event` (including subtypes such as `EducationEvent`), `Product`/`ProductGroup`, `SoftwareApplication` (on app-store hosts), `VideoObject`, `PodcastEpisode`. Walk `@graph`. A specific type outranks `Article` in the same graph.
4. **og and twitter tags**, after removing the generic values in §1a.
5. **Defuddle or Readability** for the body, only when the page reads like an article (`isProbablyReaderable`, or `article:published_time`/`datePublished`).
6. **Client-sent metadata** when the server got a shell, a challenge, or only generic tags.

### 1a. Generic metadata to treat as "no metadata" (OBS)

| Host | Generic title or description | Generic image |
|---|---|---|
| claude.ai/share | "Claude" / "Shared via Claude, an AI assistant from Anthropic" | yes |
| claude.ai/public/artifacts | "Claude Artifact" / "Try out Artifacts created by Claude users" | yes |
| chatgpt.com/share | og:title "Check out this chat" (but `<title>` is "ChatGPT - {chat title}") | `cdn.openai.com/chatgpt/share-og.png` |
| gemini.google.com/share | "Gemini - direct access to Google AI" | the aurora thumbnail |
| perplexity.ai | generic, and og:url is the homepage | `pplx-default-preview.png` |
| *.notion.site | generic, even the title; og:url is app.notion.com | yes |
| bitbucket.org | "Bitbucket", empty description | – |
| *.lovable.app | – | `lovable.dev/opengraph-image-*.png` |
| jsfiddle.net | – | `/img/og-default.png` |
| arxiv.org | – | relative `arxiv-logo-fb.png` |
| gitlab.com | – | 64×64 project avatar (too small for a card) |
| gist.github.com | – | generic gist image |

### 1b. Terms that clash with keeping metadata forever (DOC)

- **YouTube (Developer Policies):**
  - Stored API data must be deleted or refreshed within 30 days.
  - No scraping.
  - Must not use "technology other than YouTube API Services" to get YouTube data. Scraping the watch page's og tags is therefore a risk; use oEmbed or the Data API.
  - Thumbnails must be attributed to YouTube.
- **Meta (Instagram, Facebook, Threads oEmbed):**
  - Use for "any purpose … other than providing a front-end view" is prohibited, *including persisting*.
  - So store the URL only, and fetch the embed at render time.
- **Spotify:** "Do not store Spotify Content indefinitely"; keep displayed data current.
- **SoundCloud:** no persistent caching of User Content; credit the uploader and SoundCloud.
- **Reddit:** the Data API Terms (revised 2026-07-20) require the OAuth token Reddit issued and an unmasked UA. Commercial use needs a separate agreement. Anonymous `.json` is not an allowed route; it returned an HTML block page to curl (OBS).
- **arXiv:** don't store and serve e-prints from your own servers unless the licence allows. This clashes with keeping the PDF in S3.
- **Google Maps Platform §3.2.3:** no scraping, pre-fetching or storing of Maps content.
- **LinkedIn User Agreement §8.2:** no bots or scrapers.
- **Wikipedia:** text is CC BY-SA 4.0; link back and show the licence. Each image has its own licence.
- **Stack Overflow:** CC BY-SA (2.5, 3.0 or 4.0 by date). Show the site name, a link to the question, and the authors.

**Decision needed:** for these hosts, either refresh on read, or keep only the URL plus Pluck's own fields (title the user edits, tags, status), and render the embed live.

---

## 2. Video and audio

| Source | (1) Anonymous fetch | (2) Best metadata route; token; limits | (3) Embed | (4) Preview | (5) Kind / shape |
|---|---|---|---|---|---|
| **YouTube** (watch, `youtu.be`, `/shorts/`, `/live/`, playlists) | Full og tags plus `VideoObject` JSON-LD and `twitter:player` (OBS) | `youtube.com/oembed?url=&format=json`, no token: title, author_name, author_url, thumbnail_url (hqdefault 480×360), iframe html (OBS). Shorts URLs work and return `/embed/{id}` (OBS). The providers.json schemes include `/shorts*` and `/live*`. Duration and an exact "is Short" flag need the Data API `videos.list` with an API key (10,000 units/day, 1 unit per call, DOC); there is no Shorts flag (UNVERIFIED), so use the URL path. | `https://www.youtube.com/embed/{id}` iframe; 9:16 for Shorts. Required Minimum Functionality: viewport at least 200×200; **must send a Referer** (`strict-origin-when-cross-origin`, not `noreferrer`); don't obscure the player or YouTube attribution (DOC). | Thumbnail, title, channel, duration if known | Watch · `video` / `short video` / `live` / `playlist` |
| **Vimeo** | og tags plus `twitter:player` with `?h=` hash (OBS) | `vimeo.com/api/oembed.json?url=`, no token: title, author, description, duration, thumbnail_url, upload_date, html (OBS). **404** means private, unlisted without `/{hash}`, deleted or transcoding; **403** means embedding is disabled; domain-restricted videos give a truncated response (DOC). Our sample 76979871 returned 404, while `api/v2/video/{id}.json` still answered (legacy, OBS). | `player.vimeo.com/video/{id}?h={hash}`. If oEmbed returns 403/404, show the card with no player. | Thumbnail, title, author, duration | Watch · `video` |
| **TikTok** | **App shell** (OBS) | `tiktok.com/oembed?url=`, no token, but it now returns **only** type, width, height, html, provider, embed_product_id. No title, author or thumbnail (OBS, matches the doc sample). The docs say "Embed Videos will be deprecated soon". There is no legitimate anonymous route to a title or thumbnail. | `https://www.tiktok.com/player/v1/{id}?music_info=1&description=1` iframe. TikTok may apply per-domain usage limits (DOC). | `@handle` from the URL, plus the live player | Watch · `short video` (photo posts: Image · `photo post`) |
| **Loom** | not probed | `loom.com/v1/oembed?url=`, no token: title, description, thumbnail_url, duration, html (OBS). Private or workspace videos: UNVERIFIED. | `loom.com/embed/{id}` | Thumbnail, title, duration | Watch · `video` (screen recording) |
| **Spotify** (track, album, playlist, episode, show) | not probed | `open.spotify.com/oembed?url=`, no token: title, thumbnail_url (300×300), html, iframe_url. **No author, description or duration** (OBS). | `open.spotify.com/embed/{type}/{id}`. No modifying (resizing is fine); don't store content indefinitely (DOC). | Cover, title, Spotify label | Watch · `episode` / `track` / `album` / `playlist` |
| **Apple Podcasts** | not probed | `podcasts.apple.com/api/oembed` returns the **show** title even for a `?i=` episode URL (OBS). Episode title, date, duration and audio come from `itunes.apple.com/lookup?id={showId}&entity=podcastEpisode`, then match `?i=` (OBS). | `embed.podcasts.apple.com/{cc}/podcast/{slug}/id{show}?i={ep}`. Apple calls widgets "an accommodation" and may deactivate any (DOC). | Artwork, episode title, show, date, duration | Watch · `episode` / `show` |
| **Any podcast episode** | Varies; look for `<link rel=alternate type=application/rss+xml>` | RSS `<item>`: title, `enclosure`, pubDate, description, `itunes:duration`, `itunes:image`, `podcast:transcript`, `podcast:chapters` (Podcast Namespace, DOC) | `<audio src={enclosure}>`; no third-party terms | As above, plus the transcript as text if present | Watch · `episode` |
| **SoundCloud** | not probed | `soundcloud.com/oembed?format=json&url=`, no token: title, description, thumbnail_url, author_name, html (OBS) | `w.soundcloud.com/player/?url=`. Credit the uploader and SoundCloud, show visible backlinks, no persistent caching (DOC). | Artwork, title, artist | Watch · `track` / `set` |

There is no audio Kind. Audio maps to Watch with an audio shape. Decide whether a Listen Kind is ever needed.

## 3. Social posts

| Source | (1) Anonymous fetch | (2) Best metadata route; token; limits | (3) Embed | (4) Preview | (5) Kind / shape |
|---|---|---|---|---|---|
| **X / Twitter** | 200 with og:title "jack (@jack) on X", og:description = post text, og:image, `<title>` 'jack on X: "…"' (OBS) | `publish.x.com/oembed?url=&omit_script=1` (twitter.com 301s there): no auth and "not rate limited" (DOC). Returns author_name, author_url, blockquote html with the text and date, and `cache_age`. No thumbnail (OBS). The undocumented syndication CDN (`cdn.syndication.twimg.com/tweet-result?id=&token=`, what X's embed widget and react-tweet read) is used first since October 2026, by Niall's decision: it is the only tokenless route to an **X Article's** title, summary and cover (an Article post's text is just a t.co link, and `x.com/i/article/…` is 404 without a sign-in), and it carries expanded links, photos and the shared link's card. oEmbed is the fallback when it does not answer. The paid API costs per read. | Blockquote plus `platform.twitter.com/widgets.js`. A native render must show avatar, name, @handle, unmodified text, timestamp permalink, the X logo, and "View on X" (DOC). | Author, text, image | Read · `post` |
| **Threads** | **App shell** (OBS) | `graph.threads.com/v1.0/oembed?url=`, **no token since 2026-06-15** (DOC plus OBS). Returns html only. 1,000 requests/hour. No private, age-restricted or geo-gated posts. **No storing.** | Blockquote plus `threads.com/embed.js`. Normalise `threads.net` to `threads.com`. | Embed, plus `@handle` from the URL | Read · `post` |
| **Instagram** posts and reels | **App shell** (OBS) | `graph.facebook.com/v26.0/instagram_oembed?url=`, **tokenless since 2026-06-15** (DOC plus OBS). It returns **html only**: `thumbnail_url` and `author_name` were removed on 2025-11-03 (DOC). 1,000 requests/hour. No private, age-restricted or embed-disabled accounts, and no Stories. **Front-end display only; no persisting.** | `instagram-media` blockquote plus `platform.instagram.com/en_US/embeds.js` | Embed only. Stored fallback: "Instagram post" or "Instagram reel" plus the handle if it is in the URL. | Post: Image · `post` / `carousel`. Reel: Watch · `reel` |
| **Facebook** posts and videos | **HTTP 400** (OBS) | `graph.facebook.com/v26.0/oembed_video` works tokenless (OBS). `oembed_post` returned "(#100) Invalid parameter", and Meta says it is deprecating page-post oEmbed (DOC). Same no-persist rule. | JS SDK with `fb-post` / `fb-video` divs | Embed only | Video: Watch · `video`. Post: Read · `post` |
| **Bluesky** | not probed for HTML | `public.api.bsky.app/xrpc/app.bsky.feed.getPostThread?uri=at://{handle}/app.bsky.feed.post/{rkey}&depth=0`, no auth (OBS). Returns author, displayName, avatar, text, createdAt, and embed (images or a link card). Limits are unpublished. How the "no logged-out viewing" label is handled is UNVERIFIED. | `embed.bsky.app/oembed` (blockquote plus `embed.bsky.app/static/embed.js`) or the iframe `embed.bsky.app/embed/{did}/app.bsky.feed.post/{rkey}` (OBS) | Author, avatar, text, first image | Read · `post` / `thread` |
| **Mastodon** (any instance) | og tags on status pages (OBS on mastodon.social) | `https://{instance}/api/v1/statuses/{id}`, public for public posts; 401 under authorized-fetch mode. mastodon.social limit: 300 per 5 minutes (OBS). `/api/oembed?url=` works too. Detect an instance by trying the API on URLs shaped `/@user/{numeric id}`. | `https://{instance}/@{user}/{id}/embed` plus `{instance}/embed.js` (OBS) | Author, avatar, text, first media | Read · `post` |
| **LinkedIn** posts | `/feed/update/urn:li:ugcPost:{id}` gives og:title "Topic \| Author", og:image (a generic asset when the post has none), and a canonical `/posts/…` URL (OBS). The `/posts/` page has partial text behind sign-in modals. A fake id redirects to Sign Up. From datacenter IPs it may return 999 (UNVERIFIED). | No oEmbed and no public read API. og tags only; one fetch per user save, never crawl (User Agreement §8.2). | `linkedin.com/embed/feed/update/urn:li:{share\|ugcPost}:{id}` (200, OBS). Only for posts with "Anyone" visibility; the URL pattern is not in an official doc. | Author, topic, opening text | Read · `post` |

## 4. Discussion and Q&A

| Source | (1) Anonymous fetch | (2) Best metadata route; token; limits | (3) Embed | (4) Preview | (5) Kind / shape |
|---|---|---|---|---|---|
| **Reddit** (posts, comments, subreddits) | `www` returns an **app shell**; `/about.json` and `.json` return an HTML block page to curl (OBS) | `www.reddit.com/oembed?url=` with an honest UA returns title, author_name and html for post and comment permalinks (OBS; providers.json covers `/r/*/comments/*/*`). Subreddits have no oEmbed, so take the name from the URL. The Data API needs OAuth plus approval, and commercial use needs an agreement (DOC). `.json` is not an allowed route. | `reddit-embed-bq` blockquote plus `embed.reddit.com/widgets.js`. Don't modify or obscure it (Embeds Terms). | Title, `u/author`, `r/sub` | Read · `discussion` (comment permalink: `comment`; subreddit: `community`) |
| **Hacker News** | Real HTML, no og tags (OBS) | `hacker-news.firebaseio.com/v0/item/{id}.json`, no auth, "no rate limit" (DOC plus OBS). Returns title, by, time, score, descendants, url, text. | None | Title, points, comment count, author, the linked URL's domain. Offer to pluck the linked URL. | Read · `discussion` |
| **Stack Overflow** | **Cloudflare challenge** (OBS) | `api.stackexchange.com/2.3/questions/{id}?site=stackoverflow&filter=withbody`, **300 requests/day per IP without a key** (`quota_max: 300`, OBS); 10,000/day with a free key. Honour `backoff` (DOC). For the top answer: `/questions/{id}/answers?sort=votes&filter=withbody`. | None | Title, score, tags, the accepted or top answer excerpt, attribution | Read · `Q&A` |

## 5. Code

| Source | (1) Anonymous fetch | (2) Best metadata route; token; limits | (3) Embed | (4) Preview | (5) Kind / shape |
|---|---|---|---|---|---|
| **GitHub repo** | 200, server-rendered. og:title "GitHub - o/r: desc", custom social image. `X-Frame-Options: deny`. | `api.github.com/repos/{o}/{r}` plus `/readme` (`Accept: application/vnd.github.html+json`). **60 requests/hour per IP unauthenticated** (OBS header); 5,000/hour with a token or GitHub App (DOC). Unauthenticated limits on raw and the API were tightened on 2025-05-08 (DOC). | None | `o/r`, description, stars, language, topics, licence, updated, README excerpt | Read · `repo` |
| **GitHub issue / PR** | 200; og:image is `opengraph.githubassets.com/…` (1200×600). A `/pull/N` that is really an issue redirects to `/issues/N`. | `GET /repos/{o}/{r}/issues/{n}` covers both, with `pull_request` set for PRs. For a PR, `/pulls/{n}` gives merged status and diff size. | None | Title, #n, state (open, closed, merged), author, labels, comment count, body excerpt | Read · `issue` / `pull request` |
| opengraph.githubassets.com | Every server GET returned **429** (OBS) | Undocumented. Hotlink it from the client, or skip it. | – | – | – |
| **Gist** | 200, generic og image. `/{u}/{id}.js` embed uses `document.write`. | `api.github.com/gists/{id}`: files, language, content. Returned 502 for one large gist (OBS); fall back to og tags. | Render the code ourselves; the `.js` embed only works in a sandboxed `srcdoc` iframe. | Description, owner, file names, first ~20 lines | Read · `gist` |
| **GitHub file** (`/blob/`) | 200; og tags are the repo's; title is "path at ref · o/r" | `raw.githubusercontent.com/{o}/{r}/{ref}/{path}` (`text/plain`, CORS `*`) or `/contents/{path}?ref=` | None | Path, repo, ref, language, first N lines; respect `#L10-L20` | Read · `code file` |
| **GitLab** project, issue, MR, snippet | Server-rendered with og tags; image is a 64×64 avatar. Issues redirect to `/-/work_items/{n}`. | `gitlab.com/api/v4/projects/{encoded path}`, `/issues/{iid}`, `/merge_requests/{iid}`, anonymous (OBS). `ratelimit-limit: 500` per minute per IP today; a 60/hour limit has been proposed (DOC). | Snippet `.js` script embed (DOC) | As for GitHub | Read · `repo` / `issue` / `merge request` / `snippet` |
| **Bitbucket** | **App shell**, title "Bitbucket", no og tags (OBS) | API 2.0 `/2.0/repositories/{ws}/{slug}`, `/pullrequests/{id}`, anonymous; **60/hour per IP** (DOC) | None | Name, description, language, PR title and state | Read · `repo` / `pull request` |
| **CodePen** | **403 Cloudflare challenge** for the page and `/api/oembed` (OBS) | The oEmbed doc lists title, author, thumbnail and an iframe html, but the endpoint is unreachable from our server. Use client metadata. | oEmbed iframe (click-to-play) | Title, author, thumbnail | Read · `pen` |
| **CodeSandbox** | `/s/{id}` returns 200 with og tags and `og:author`; the oEmbed endpoint returns a **403 challenge** (OBS) | Page og tags | `codesandbox.io/embed/{id}` (no X-Frame-Options, OBS) | Title, description, author | Read · `sandbox` |
| **StackBlitz** | 200 with og tags and a per-project og:image (OBS) | oEmbed discovered from the page: `stackblitz.com/api/oembed?url=` (OBS; not in providers.json) | `?embed=1` plus `file`, `hideExplorer`, `hideDevtools` (DOC) | Title, description, author, image | Read · `sandbox` |
| **JSFiddle** | 200; og tags plus `author` meta; generic image; the code is in the page text (OBS) | Page tags | `jsfiddle.net/{u}/{id}/embedded/{tabs}/` (DOC); a server curl redirected, and iframe behaviour is UNVERIFIED | Title, author, code excerpt | Read · `fiddle` |
| **Replit** repl | 200 with og tags and author; `X-Frame-Options: DENY` (OBS) | `replit.com/data/oembed` returns title and author (OBS) | **Effectively dead:** `?embed=true` 301s to the normal page, and Replit says "embeds are going away" (DOC plus OBS) | Title, description, author, image | Read · `repl` |

## 6. Packages

| Source | (1) Anonymous fetch | (2) Best metadata route | (3) Embed | (4) Preview | (5) Kind / shape |
|---|---|---|---|---|---|
| **npm** (`npmjs.com/package/x`) | **Cloudflare challenge** (OBS) | `registry.npmjs.org/{pkg}/latest`: name, version, description, licence, repository, homepage. No README there; the full `/{pkg}` document has it but can be large. No auth; no documented limits. | None | name@version, description, licence, repo, README as the body | Read · `package` |
| **PyPI** (`pypi.org/project/x`) | **JS client challenge** (OBS) | `pypi.org/pypi/{p}/json`: summary, version, description (the README), project_urls, licence (DOC) | None | Same | Read · `package` |

## 7. AI share and artifact links

None of these have an API or oEmbed. Most return a generic app shell. These rows need client-sent metadata the most.

| Source | (1) Anonymous fetch (OBS) | (2) Best route | (3) Embed | (4) Preview | (5) Kind / shape |
|---|---|---|---|---|---|
| **claude.ai/share/{id}** | Shell, generic og, `x-robots-tag: none`, no conversation text | Client title; otherwise "Claude conversation" | None | Title the user or client supplies | Read · `AI chat` |
| **claude.ai/public/artifacts/{id}** (the old `claude.site/artifacts` 301s here) | Shell, generic og | Client title | The publisher can "Get embed code" (DOC); a third-party iframe of the public URL is UNVERIFIED | Title | Read · `AI artifact` |
| **chatgpt.com/share/{id}** | Server-rendered. `<title>` is "ChatGPT - {chat title}"; og tags are generic. The full text is inside a serialized React stream (undocumented, so don't parse it). `X-Frame-Options: SAMEORIGIN`. | Use `<title>` with the "ChatGPT - " prefix removed | None | Title | Read · `AI chat` |
| **gemini.google.com/share, g.co/gemini/share** | 302 to gemini.google.com; generic shell; no text; `X-Frame-Options: DENY` | Client title | None | Title | Read · `AI chat` |
| **perplexity.ai/page, /search** | Shell; generic og; og:url is the homepage; `X-Frame-Options: DENY` | Title from the slug (`bird-flu-data-disappears-{id}` becomes "Bird flu data disappears") | None | Slug title | Read · `AI answer` |
| **v0** (`v0.dev` 301s to `v0.app/{team}/chat/{slug}`) | Server-rendered: og:title "{name} - v0 by Vercel", og:description is the first prompt, **per-chat og:image** | Page og tags | None; generated apps are ordinary `*.vercel.app` sites | Name, prompt, image | Read · `AI app` |
| **bolt.new** / `*.bolt.host` | Marketing page; deployments are plain HTML, often only a `<title>`; the project URL format is UNVERIFIED | Page tags | None | Title | Read · `AI app` |
| **Lovable** (`lovable.dev/projects/{uuid}`, `*.lovable.app`) | Projects return **403** with a shell; `.lovable.app` returns the app's index with a generic og image | Page tags, minus the generic image | None | Title, description | Read · `AI app` |
| **Replit apps** (`*.replit.app`) | Ordinary sites; the dead ones say "This app isn't live yet" (404) | Page tags | None | Author's og tags | Read · `AI app` |

## 8. Docs and design files

| Source | (1) Anonymous fetch | (2) Best metadata route | (3) Embed | (4) Preview | (5) Kind / shape |
|---|---|---|---|---|---|
| **Google Docs** (anyone with the link) | `/edit` returns 200 with og:title, og:description (the first ~300 characters) and og:image (a page render); the body is JS only; `x-robots-tag: noindex, nofollow, nosnippet`; 410 if deleted (OBS) | **`/export?format=txt\|html\|pdf`** returns 200 unless the owner disabled downloads (OBS). Docs that are published to the web (`/d/e/2PACX…/pub`) are server-rendered HTML. | `/preview` (no X-Frame-Options) or `/pub?embedded=true` | Title, first paragraph, page image | Read · `doc` |
| **Google Slides** | `/edit` has og:title and a slide image | Exports returned 401 when downloads were disabled (OBS). Try export, then fall back to og. | `/embed` or `/preview` as an iframe. They are **18 MB**, so never fetch them server-side. | Title, cover | Read · `slides` |
| **Google Sheets** | `/edit` has og tags | `/export?format=csv` returns 200 `text/csv` (OBS) | `/preview` or `/pubhtml?widget=true` | Title, image, the first rows as a table | Read · `sheet` |
| **Google Drive file** | `/view` og:title is the filename only; `X-Frame-Options: SAMEORIGIN` | `uc?export=download&id=` 302s to `drive.usercontent.google.com`, served as **application/octet-stream**, so check for `%PDF-` magic bytes (OBS). The large-file virus-scan interstitial is UNVERIFIED. | `/file/d/{id}/preview` | Filename, type, size | PDF / Image / Read by sniff · `file` |
| **Notion** (`*.notion.site`) | **JS shell with generic og, even the title** (OBS) | Title from the slug (the words before the 32-hex id). The official API needs the page shared with an integration. | Published pages: "Embed this page" (DOC); `/{site}.notion.site/ebd/{id}` allows framing (OBS; the path is UNVERIFIED as a contract) | Slug title | Read · `doc` |
| **Figma** | `/design/{key}` has twitter:title and twitter:image, plus `link rel=oembed`; no og:title (OBS) | `figma.com/api/oembed?url=` (public files): title, folder_name, html, **a thumbnail_url signed for about 1 day, so copy it to S3** (OBS). Community URLs are rejected. | Embed Kit 2.0: `embed.figma.com/{design\|board\|proto\|slides\|deck}/{key}?embed-host={ours}` (DOC) | Title, folder, thumbnail | Image · `design file` |
| **Canva / Miro** | not probed | oEmbed `canva.com/_oembed` (`/design/*/view`), `miro.com/api/v1/oembed` (`/app/board/*`) (providers.json) | oEmbed html | Title, thumbnail | Image · `design` / `board` |

## 9. Articles behind paywalls, papers and PDFs

| Source | (1) Anonymous fetch | (2) Best metadata route | (3) Embed | (4) Preview | (5) Kind / shape |
|---|---|---|---|---|---|
| **Substack**, including custom domains | 200, full og tags, `author` meta, RSS link. **A paid post contains the free preview** in `.available-content`, then `.paywall` and `"audience":"only_paid"`; the sample showed 2,273 of 4,153 words (OBS). CSP blocks framing outside substack.com. | Page og tags plus Defuddle scoped to `.available-content`. `/api/v1/posts/{slug}` gives wordcount and audience but is undocumented (UNVERIFIED as a contract). | None | Title, subtitle, author, date, cover, a "Paid · preview" flag, read time from the full wordcount | Read · `article` (`paywalled`) |
| **Medium** (and `*.medium.com`) | **403 Cloudflare "blocked"** (OBS) | RSS `medium.com/feed/@user` and `/feed/{pub}` return about the last 10 items; `content:encoded` is the full text for free posts and **~10 words for member-only posts** (OBS). Older posts need client capture. | None | Title, author, date, image | Read · `article` |
| **arXiv** | `/abs/{id}` is server-rendered with `citation_title`, `citation_author` (one per author), `citation_date`, `citation_pdf_url`; og:description is the abstract; `frame-ancestors 'none'`. `/pdf/{id}` returns `application/pdf` with no `.pdf` in the URL (OBS). | `export.arxiv.org/api/query?id_list={id}` (Atom); **1 request per 3 seconds**, one connection; metadata is CC0 (DOC). | No iframe | Title, authors, date, abstract, id, PDF link | abs: Read · `paper`; `/pdf`: PDF · `paper` |
| **Hosted PDFs and whitepapers** | Detect in this order: `Content-Type: application/pdf` (handled today); `%PDF-` magic bytes when the type is octet-stream (**not handled today**; Drive does this); on HTML landing pages, `<meta name="citation_pdf_url">` (Highwire, absolute) or `DC.identifier`; `<link rel=alternate type=application/pdf>` (UNVERIFIED in the wild) | unpdf as today. For a landing page, keep it as Read and offer "Pluck the PDF", or follow `citation_pdf_url`. | Native PDF viewer on our own copy (check licence; see the arXiv terms) | Title (PDF info, else the landing page), authors, page count | PDF · `paper` / `whitepaper` / `report` |

## 10. Commerce, apps, places, events, recipes, jobs, homepages, reference

`thing` is a Kind, but not one of `LINK_KINDS`. Products, apps, places and events fit Thing best, but they arrive as links. Either allow `thing` from extraction, or keep them as Read with a shape.

| Source | (1) Anonymous fetch | (2) Best metadata route | (3) Embed | (4) Preview | (5) Kind / shape |
|---|---|---|---|---|---|
| **Amazon** | Residential IP: 1.3 MB of real HTML with **no og tags** (`#productTitle`, `#landingImage`, meta description). Datacenter: **503**. Honest UA: captcha (OBS). | The Creators API replaced PA-API 5 (PA-API now returns 403 "deprecated"). It needs an Associates account and qualifying sales every 30 days; 1 request/second and 8,640/day (DOC). **Unsuitable.** Rely on client HTML. | No (`X-Frame-Options: SAMEORIGIN`) | Title (strip "Amazon.com:"), image, ASIN from `/dp/{ASIN}`, domain. No price. | Thing (or Read) · `product` |
| **Shopify stores** | Chrome UA got 429; honest UA got 200 (OBS). `og:type=product`, `og:price:amount`/`currency`, JSON-LD `Product`/`ProductGroup`/`Offer`. | **`/products/{handle}.js`** (the documented Ajax API, no auth; prices in minor units, DOC). `.json` and `.oembed` work but are undocumented. | No | Title, vendor, image, price, in stock | Thing · `product` |
| **Any product page** | Varies | JSON-LD `Product` (name, image, brand, offers.price/priceCurrency/availability, aggregateRating), then `product:price:*` or `og:price:*` | – | Same | Thing · `product` |
| **SaaS / company homepage** | Real HTML: Stripe, Vercel, Notion, Figma, Linear (OBS) | og tags plus JSON-LD `Organization`/`WebSite`/`SoftwareApplication`. Don't run Defuddle into the marketing copy; show the description instead. | No | Title, description, og:image, favicon, domain. No reading time. | Read · `homepage` |
| **Wikipedia** | Real HTML; og:title and og:image, **no og:description**; `og:type=website` (OBS) | `{lang}.wikipedia.org/api/rest_v1/page/summary/{title}`: title, description, extract, thumbnail (OBS). **A UA with contact details is required.** 2026 limits: 10 requests/minute unidentified, 200/minute for a compliant bot UA (DOC). RESTBase is being retired; no sunset date yet for `summary`. | No official embed | Title, short description, first sentences, thumbnail, CC BY-SA notice | Read · `reference` |
| **Google Maps** (`maps.app.goo.gl`, `/maps/place/`) | A Chrome UA gets a JS interstitial; a non-browser UA gets a 302 to `/maps/search/{lat},{lng}`. From the EU everything 302s to `consent.google.com` (OBS). | **Don't scrape** (Platform Terms §3.2.3). Follow redirects and parse the place name, coordinates or place_id **from the URL only**. | Maps Embed API, **needs a free key** (`/maps/embed/v1/place?key=&q=`). A no-key link: `google.com/maps/search/?api=1&query=` (DOC). | Place name, coordinates, "Open in Maps" | Thing · `place` |
| **App Store** | Real HTML, og tags, JSON-LD `SoftwareApplication` (OBS) | `itunes.apple.com/lookup?id={id}&country={cc}`, no key, about 20/minute (DOC): name, developer, icon, price, rating, genre, screenshots | No (`X-Frame-Options: DENY`) | Icon, name, developer, price, rating | Thing · `app` |
| **Google Play** | Real HTML, og tags, JSON-LD `SoftwareApplication` (OBS) | og tags plus JSON-LD; no public API | No | Same | Thing · `app` |
| **Eventbrite** | Real HTML; `og:type=events.event`, `event:start_time`; JSON-LD `Event` subtype (OBS) | JSON-LD. The API needs a token on every call (DOC). | No | Name, start and end with time zone, online or in person, venue or city, image, organiser | Thing · `event` |
| **Luma** (`lu.ma` 301s to `luma.com`) | Real HTML; **`og:type=article`** (misleading); JSON-LD `Event` with `Place` and `GeoCoordinates` (OBS) | JSON-LD | **`luma.com/embed/event/{evt-id}/simple`** iframe (DOC; no X-Frame-Options, OBS) | Same | Thing · `event` |
| **Recipes** | Allrecipes 403; RecipeTin Eats 200 with `Recipe` alongside `Article` in one `@graph` (OBS) | JSON-LD `Recipe`: name, image, recipeIngredient, recipeInstructions, totalTime (ISO 8601), recipeYield, nutrition, aggregateRating (DOC). **Recipe outranks Article.** | – | Image, name, total time, yield, ingredient count | Read · `recipe` (body: ingredients plus steps from JSON-LD, not the blog post) |
| **Jobs: Greenhouse** | Real HTML, `og:type=article`, no JobPosting (OBS) | `boards-api.greenhouse.io/v1/boards/{token}/jobs/{id}?pay_transparency=true`, no auth (DOC) | No | Title, company, location, date, pay | Read · `job` |
| **Jobs: Lever** | JSON-LD `JobPosting` (OBS) | `api.lever.co/v0/postings/{site}/{id}` (EU: `api.eu.lever.co`), no auth (DOC) | – | Same | Read · `job` |
| **Jobs: Ashby** | Shell, but the HTML includes `JobPosting` JSON-LD (OBS) | `api.ashbyhq.com/posting-api/job-board/{board}`, no auth; returns the whole board, so filter by id (DOC) | – | Same | Read · `job` |
| **Jobs: LinkedIn** | Residential: og:title "Title at Company — Location \| LinkedIn Jobs"; no JSON-LD (OBS) | og tags only; no scraping beyond one fetch per save | No | Parse title, company and location from og:title | Read · `job` |
| **Any job post** | – | JSON-LD `JobPosting`: title, hiringOrganization, jobLocation, datePosted, baseSalary, employmentType, validThrough (DOC) | – | – | Read · `job` |

### 10a. Telling a homepage from an article

og:type is unreliable on its own (OBS):

| Page | og:type |
|---|---|
| Vercel blog post | `website` |
| Wikipedia article | `website` |
| Luma event | `article` |
| Greenhouse job | `article` |
| Linear homepage | none |

Work through these in order:

1. **A specific JSON-LD type wins:** Recipe, JobPosting, `*Event`, Product, SoftwareApplication on a store host.
2. **Homepage when all of these hold:**
   - the path is `/` or a single locale segment (`/ie`, `/en-us`; Stripe 307s to `/ie`);
   - there is no `article:published_time` or `datePublished`;
   - the JSON-LD has only `WebSite`, `Organization` or `SoftwareApplication`.

   That held for Stripe, Vercel, Notion and Figma. Readability's `isProbablyReaderable` returning false supports it.
3. **Article when any of these hold:** `article:published_time`, a JSON-LD `Article`/`NewsArticle`/`BlogPosting` with `datePublished`, path depth of at least 2 with a date or slug.

---

## 11. Referral parameters and Referer

### 11a. What reader apps appended

| App | Parameter | Evidence |
|---|---|---|
| **Pocket, iOS** | `utm_source=pocket_saves`, `pocket_home` or `pocket_reader`, depending on the screen. It **replaced** an existing `utm_source` and kept other parameters. | `Pocket/pocket-ios` commit `1803289a`, 2023-04-06, "feat: add utm_source when sharing from home, saves, and reader" (`PocketURLs.swift`, `PocketItemActivity.swift`). HN 36543834 (2023-07-01) reports `?utm_source=pocket_saves` on saved links. |
| **Pocket, Android 8.x** | `utm_source=pocket_mylist`. It first **removed every existing `utm_*`**, then set its own. | Decompiled APK (`vlad-cotfas/Pocket-Log-Inject`, `smali_classes2/mc/b$a.smali`); the version date is UNVERIFIED |
| **Pocket, in the wild** | `pocket_mylist`, `pocket_saves`, `pocket_reader`, `pocket_shared`, `pocket_list` | Public Plausible stats for docs.python.org (`hugovk/plausible-stats`, 2023-08-10 to 2025-07). Pocket shut down on 2025-07-08. |
| Instapaper, Readwise Reader, Omnivore (open source; only fixtures matched), Matter | None found | Code search plus the python.org stats |
| Hacker News | None | 0 of 30 front-page links (OBS) |
| Feedly | `utm_source=feedly`, historically | A 2013 userscript removes it; current behaviour UNVERIFIED |
| Flipboard | `utm_source=flipboard`, often with `utm_content=topic%2F…` | Seen in shared URLs and the python.org stats (2025); undocumented |

**The convention:** a single `utm_source={app}` (Pocket used `{app}_{surface}`), no `utm_medium` or `utm_campaign`, applied only to outbound clicks, never to the stored URL. Pluck already removes `utm_*` on paste (the `paste.json` fixture), so the stored URL stays clean, which matches. Proposed value: `utm_source=pluck` or `pluck_{surface}`.

### 11b. URLs that break when a parameter is added

| URL | Result | Why |
|---|---|---|
| S3 presigned (SigV4) | **Breaks** (`SignatureDoesNotMatch`) | Every query parameter except `X-Amz-Signature` is in the canonical request (DOC). This includes Pluck's own MinIO and S3 links. |
| Google Cloud signed URL (V4) | **Breaks** | Every parameter except the signature is signed (DOC) |
| CloudFront signed URL, canned policy | **Breaks** | The policy resource is the full URL with its query (DOC). A custom wildcard policy may survive (UNVERIFIED). |
| Azure SAS | Probably survives (UNVERIFIED) | Only the signed fields go into the string-to-sign |
| Other signed or one-time links (magic links, unsubscribe, HMAC tokens) | Treat as breaking | Skip a URL whose query has `X-Amz-*`, `X-Goog-*`, `Signature`, `sig`, `token`, `Expires`, `Key-Pair-Id` or `se`+`sig` |
| Hash routes (`#/…`), text fragments (`#:~:text=`) | Breaks if appended naively | The parameter must go **before** `#`. `URL.searchParams.set` places it correctly (OBS). |
| Re-encoding | Can alter the URL | `URL.searchParams.set` re-serialises the whole query: `q=a%20b` becomes `q=a+b` (OBS). Append `&utm_source=…` to the raw `search` string instead. |
| Strict apps, and the query as data | Occasionally a 400 or 404, a redirect, or changed results or cache keys | No specific vendor verified |
| Existing `utm_source`, `mailto:`, app deep links | Rule needed | Leave an existing value alone, or replace it as Pocket iOS did; skip non-http(s) links |

### 11c. Referer

| Context | Referer sent | Basis |
|---|---|---|
| `<a target=_blank>` with no `rel` | Origin only (`https://getpluck.io/`) for HTTPS to HTTPS; none for HTTPS to HTTP. `target=_blank` implies noopener (Chrome 88, Firefox 79, Safari 12.1). | WHATWG, MDN, browser-compat-data |
| `rel=noopener` | Same as above; it only nulls `window.opener` | WHATWG, MDN |
| `rel=noreferrer` | **None** (policy `no-referrer`; implies noopener) | WHATWG link types |
| Default policy | `strict-origin-when-cross-origin` (Chrome 85, Firefox 87, Safari 15) | browser-compat-data |
| SFSafariViewController (iOS) | **Likely none** (UNVERIFIED): there is no API for headers, and the navigation has no source document. Parse.ly reports iOS 26 Safari strips referrers. | Apple API surface, Parse.ly |
| expo-web-browser `openBrowserAsync` | iOS: SFSafariViewController, as above. Android: `CustomTabsIntent` built with no session and no `EXTRA_REFERRER`, so Chromium sends **none** (from the source code; not tested on a device). | expo `WebBrowserSession.swift` and Android module; Chromium `IntentHandler.getReferrerUrl` |
| Custom Tabs with `Intent.EXTRA_REFERRER = android-app://{pkg}` | `Referer: android-app://{pkg}` | Chrome docs; needs native code |

**What this means for Pluck:**

- **Web:** dropping `noreferrer` in favour of `noopener` on "Open original" would give publishers `getpluck.io` as the referrer at no cost.
- **YouTube embeds:** they *require* a Referer.
- **iPhone app:** sends no Referer, so a query parameter is the only signal there.
- **If you add the parameter:** skip signed URLs, put it before `#`, and append it raw.

---

## 12. How codu.co shows shared links

Repo `codu-code/codu`, branch `develop`, read 2026-10-25. It is described here for reference only.

**Fetching** (`app/api/fetch-metadata/route.ts`):

- Runs only for signed-in users, from the compose form.
- Sends an honest UA, `Mozilla/5.0 (compatible; CoduBot/1.0; +https://codu.co)`, with an 8 s timeout, reading at most 150 KB of HTML.
- Uses regex only: og:title or `<title>`; og:description or meta description; og:image or twitter:image (absolute http(s) or `//` only); og:site_name.
- Read time is the word count of the whole stripped HTML divided by 225, clamped to 1–30 minutes.
- No oEmbed, no JSON-LD, no per-host rules.
- `hooks/useLinkMetadata.ts` debounces the fetch by 500 ms.

**Compose preview** (`components/Create/ComposeModal.tsx`):

- A card with a 16:9 image area (it reads "fetching preview…" or "preview image" while there is no image).
- Below the image: the title (the user's typed title overrides og:title), a small accent square plus the domain in mono, and a three-line-clamped description (og:description, else the body the user typed).
- The image URL is kept only if it is absolute http(s).

**Feed card** (`components/UnifiedContentCard/UnifiedContentCard.tsx`):

- A "Link" chip, then the author avatar and name, relative time and "· N min".
- The title, followed by a faint " ↗" for links.
- A two-line-clamped excerpt.
- A **104×68 thumbnail on the right**, shown only if the image actually loads: `onError`, plus a ref callback that hides images with `naturalWidth === 0` after SSR. There is no grey placeholder.
- The card links to codu's own page `/{username}/{slug}`. Clicks on links are tracked with `trackClick`.

**Detail page** (`app/(app)/[username]/[slug]/_userLinkDetail.tsx`):

- An eyebrow line, "// Link · date".
- A large title and the excerpt as a lede.
- An author row: avatar, name, and "@user · hostname".
- The cover image, max height 400px, linked out, with a frosted hostname pill and an external-link icon in the bottom-right corner. Without a cover there is a dotted-grid placeholder.
- A full-width primary button, "Visit Link at {hostname}".
- Votes, comments and a share button.
- Outbound links use `target=_blank rel="noopener noreferrer"`, and `safeExternalHref` forces https and rejects `javascript:` and `data:` links. So codu sends no Referer and no referral parameter.

**Dedupe:** `server/lib/normalizeUrl.ts` strips `utm_*`, `ref`, `ref_*`, `fbclid`, `gclid`, `mc_*` and `igshid`, lowercases the host, drops `www.` and the hash, sorts the query, and removes a trailing slash.

---

## Sources

- oEmbed list: https://oembed.com/providers.json
- **YouTube:** https://developers.google.com/youtube/terms/developer-policies · https://developers.google.com/youtube/terms/required-minimum-functionality · https://developers.google.com/youtube/player_parameters · https://developers.google.com/youtube/v3/determine_quota_cost
- **Vimeo:** https://developer.vimeo.com/api/oembed/videos · https://help.vimeo.com/hc/en-us/articles/12427906892689-Use-oEmbed-with-private-videos
- **TikTok:** https://developers.tiktok.com/doc/embed-videos · https://developers.tiktok.com/doc/embed-player
- **Meta (Instagram, Facebook, Threads):** https://developers.facebook.com/docs/instagram-platform/oembed · https://developers.facebook.com/blog/post/2025/04/08/oembed-updates/ · https://developers.facebook.com/blog/post/2026/06/15/tokenless-access-to-meta-oembed-apis/ · https://developers.facebook.com/docs/plugins/embedded-posts · https://developers.facebook.com/docs/threads/tools-and-resources/embed-a-threads-post
- **X:** https://docs.x.com/x-for-websites/oembed-api · https://docs.x.com/developer-terms/display-requirements
- **Mastodon:** https://docs.joinmastodon.org/methods/statuses/ · https://docs.joinmastodon.org/methods/oembed/
- **Reddit:** https://redditinc.com/policies/data-api-terms · https://redditinc.com/policies/embeds-terms
- **LinkedIn:** https://www.linkedin.com/help/linkedin/answer/a529065 · https://www.linkedin.com/legal/user-agreement
- **Hacker News:** https://github.com/HackerNews/API
- **Loom:** https://dev.loom.com/docs/embed-sdk/api
- **Spotify:** https://developer.spotify.com/documentation/embeds/reference/oembed · https://developer.spotify.com/terms
- **Apple Podcasts:** https://podcasters.apple.com/support/5619-apple-podcasts-embed-player
- **Podcast namespace:** https://github.com/Podcastindex-org/podcast-namespace/blob/main/docs/1.0.md
- **SoundCloud:** https://developers.soundcloud.com/docs/oembed · https://developers.soundcloud.com/docs/api/terms-of-use
- **GitHub:** https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api · https://github.blog/changelog/2025-05-08-updated-rate-limits-for-unauthenticated-requests/
- **GitLab:** https://docs.gitlab.com/user/gitlab_com/rate_limits/ · https://docs.gitlab.com/user/snippets/
- **Bitbucket:** https://support.atlassian.com/bitbucket-cloud/docs/api-request-limits/
- **Stack Exchange:** https://api.stackexchange.com/docs/throttle · https://stackoverflow.blog/2009/06/25/attribution-required/
- **PyPI:** https://docs.pypi.org/api/json/
- **npm:** https://github.com/npm/registry/blob/main/docs/REGISTRY-API.md
- **CodePen:** https://blog.codepen.io/documentation/oembed/
- **JSFiddle:** https://docs.jsfiddle.net/embedding-fiddles
- **StackBlitz:** https://developer.stackblitz.com/docs/platform/embedding
- **Replit:** https://blog.repl.it/embeds-are-going-away
- **Figma:** https://developers.figma.com/docs/embeds/embed-figma-file/
- **Notion:** https://www.notion.com/help/public-pages-and-web-publishing
- **Claude:** https://support.claude.com/en/articles/9547008-discovering-publishing-customizing-and-sharing-artifacts
- **ChatGPT:** https://help.openai.com/en/articles/7925741-chatgpt-shared-links
- **v0:** https://v0.app/docs/sharing
- **arXiv:** https://info.arxiv.org/help/api/tou.html
- **Google Scholar:** https://scholar.google.com/intl/en/scholar/inclusion.html
- **Amazon:** https://affiliate-program.amazon.com/creatorsapi/docs/en-us/paapiv5-deprecation · https://affiliate-program.amazon.com/creatorsapi/docs/en-us/concepts/api-rates
- **Shopify:** https://shopify.dev/docs/api/ajax/reference/product
- **Wikimedia:** https://www.mediawiki.org/wiki/Wikimedia_APIs/Access_policy · https://www.mediawiki.org/wiki/Wikimedia_APIs/Rate_limits · https://www.mediawiki.org/wiki/RESTBase/deprecation · https://en.wikipedia.org/wiki/Wikipedia:Reusing_Wikipedia_content
- **Google Maps:** https://cloud.google.com/maps-platform/terms · https://developers.google.com/maps/documentation/embed/get-started · https://developers.google.com/maps/documentation/urls/get-started · https://developers.googleblog.com/en/google-url-shortener-links-will-no-longer-be-available/
- **Apple App Store:** https://performance-partners.apple.com/search-api
- **Luma:** https://help.luma.com/p/embed-luma-on-your-website
- **Eventbrite:** https://www.eventbrite.com/platform/api
- **Google structured data:** https://developers.google.com/search/docs/appearance/structured-data/recipe · https://developers.google.com/search/docs/appearance/structured-data/job-posting
- **Job boards:** https://docs.greenhouse.io/job-board.html · https://github.com/lever/postings-api · https://developers.ashbyhq.com/docs/public-job-posting-api
- **Pocket:** https://github.com/Pocket/pocket-ios/commit/1803289a2d616c56593cf384d9b11a66e4bff067 · https://news.ycombinator.com/item?id=36543834 · https://github.com/hugovk/plausible-stats
- **Signed URLs:** https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_sigv-create-signed-request.html · https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/private-content-creating-signed-url-canned-policy.html · https://cloud.google.com/storage/docs/authentication/canonical-requests · https://learn.microsoft.com/en-us/rest/api/storageservices/create-service-sas
- **Referrer:** https://html.spec.whatwg.org/multipage/links.html · https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Attributes/rel/noreferrer · https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Referrer-Policy · https://developer.chrome.com/docs/android/custom-tabs/guide-ui-customization · https://docs.parse.ly/ios-26-update-increases-direct-traffic/
- **codu:** https://github.com/codu-code/codu (develop): `app/api/fetch-metadata/route.ts`, `components/Create/ComposeModal.tsx`, `components/UnifiedContentCard/UnifiedContentCard.tsx`, `app/(app)/[username]/[slug]/_userLinkDetail.tsx`, `server/lib/normalizeUrl.ts`

**Not checked:**

- Anything from a Vercel or AWS IP.
- CORS on Meta oEmbed, which decides whether the browser can fetch it at render time.
- Vimeo and Bluesky rate limits.
- Loom private videos.
- The CodePen embed URL form.
- Drive large-file interstitials.
- bolt.new project URLs.
- Referer on a real device.
- Signed-URL breakage against live MinIO.
