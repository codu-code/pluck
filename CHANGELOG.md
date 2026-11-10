# Changelog

What changed in each release of Pluck, for people who run their own copy and people who work on the code. The shape follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the numbers follow [Semantic Versioning](https://semver.org/).

A release is a tag `v<version>` on `main`, the Docker image `ghcr.io/codu-code/pluck:<version>` built from it, and a GitHub release whose notes are that version's section here ([docs/deploy.md](docs/deploy.md), "Cutting a release"). The iPhone and iPad app, Pluck for Chrome and `@getpluck/mcp` keep their own version numbers.

## [Unreleased]

## [0.1.0] - Unreleased

The first tagged release, and the first published image: `docker compose up -d` pulls it for amd64 and arm64, with no build (`docs/self-host.md`).

### What Pluck does at 0.1.0

- **Pluck anything in one tap:** a link, a Note, a Todo or a Thing, from the web (one link or a paste of many), the browser extension, the iPhone and iPad share sheet, Siri and Shortcuts, email-in, or a chat with your AI. A Re-pluck brings the Item back to the Inbox and never makes a second one.
- **The page is kept, not just the link.** Each link opens as what it is: an article in the Reader, a video in a player, a post, a repo, a product, a PDF on its own pages.
- **Kinds and Statuses:** Read, Watch, PDF, Image, Note, Todo, Thing; Inbox, Later, Archived, Done. Tags, Highlights, and search across your library, in Japanese, Chinese and Korean too.
- **Lists:** ordered, with a note and a tick per Item. Private, Public at `/@handle/slug`, or shared with particular people by email, See only. A public List has an Atom feed at `/@handle/slug/feed.xml`.
- **Expiry:** Items you never touch move to the Archive after the number of days you pick. Nothing is deleted. A deleted Item waits 30 days in the Bin.
- **The Digest:** a weekly email of what will expire, what is due and what is oldest, on Monday unless you pick another day.
- **The connector:** your AI reads and organises your library over MCP at `/mcp`, with OAuth, or through `npx @getpluck/mcp` for tools that only speak stdio. There is no AI inside the app. Your AI cannot delete anything unless you grant it, cannot make a List public, and what it adds is marked "by AI". It finds an Item by what you highlighted in it, lists your highlights across the library, and every tool declares the shape of its result.
- **Import and export:** import from Pocket, Omnivore, Raindrop, Instapaper, Readwise Reader, Wallabag, Linkwarden, Karakeep and browser bookmarks; export everything as JSON and Markdown, with a `bookmarks.html` that a browser or another app can import; delete the account yourself.
- **Apps:** the web app, Pluck for Chrome (from 0.2.4 its Options can point it at a server you run, once you allow it; there is a Firefox build too), Android's Share sheet through the installed web app, and the iPhone and iPad app, which works offline from the last copy and keeps the newest Items for reading with no connection.
- **Sign-in by email only:** a link on the web, a 6-digit code on the iPhone. API keys for scripts and the stdio bridge.
- **Ten languages:** English, Spanish, Portuguese (Brazil), French, German, Japanese, Italian, Dutch, Korean and Chinese (Simplified).
- **Run your own:** one Docker image for the web app and the worker, with MongoDB and an S3-compatible blob store, under Apache-2.0. Analytics are off unless you build with your own PostHog key. What Pluck defends against, and where each rule lives, is in `docs/threat-model.md`.

### Since the repository went public (2026-10-27)

#### Security

- A registered OAuth client, and a grant, can no longer be edited after consent.
- `SIGNUP_EMAILS` closes sign-up on your server to the addresses and domains you name. Unset, anyone who can reach the server can sign up.
- An upload link takes only the size and type that were declared for it.
- An API key cannot make a List public, share it with people, or change the handle or the email-in address, and the connector has no tool that makes a List public.
- Wrong sign-in codes typed by a stranger no longer spend the owner's tries.
- The private-address guard also refuses loopback written as an IPv4-compatible or IPv4-translated IPv6 address, local-use NAT64 and Teredo.
- Email-in refuses a message when any copy of its spam or virus verdict header says FAIL.
- A fetched picture is stored under its own type, not the header the other server sent, and a paper's PDF address is kept only when it is http or https.
- Signing out on the web stays signed in, and says so, when the server did not hear it. Plucks waiting on a device go up only as the person who made them.
- Dependencies with open security alerts are patched (zod, xmldom, fflate, uuid, node-forge, glob, minimatch).

#### Your data

- A link is kept as it was plucked; only the key that spots a Re-pluck is normalised.
- A long export or import is not handed out twice, and only the runner holding a job can finish it.
- A retried email-in job finishes the Item instead of deleting the message.
- A Note, Todo or Thing whose answer was lost on the way back is not made twice, and a Re-pluck that arrives twice adds its note once.
- A Kind you chose stays yours when the page is read again.
- A retried Monday email is sent once, and a crash while queueing them no longer skips the people after it.
- A database blip at start no longer fails every query until a restart.
- Import files and old export zips are cleared away, and exports are capped at five a day.

#### Running it

- The image carries its pinned pnpm, so a container starts with no network.
- The worker starts after `web` is healthy, so a first start makes one session secret, not two.
- The bundled MinIO makes the bucket `S3_BUCKET` names.
- A failed health check logs why, so a wrong `MONGODB_URI` shows in `docker compose logs`.
- One person's links no longer hold up everyone else's emails, files and exports.
- A PDF is read for its first 300 pages and stops when its time is up.
- Counts come off an index instead of reading the library.
- Only a refused grant signs the extension or the iPhone out, not a 403, a 404 or an error page from a proxy.
- `@getpluck/mcp` is published from a tag by a workflow, with npm provenance.
