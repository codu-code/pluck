# Launch checklist

Everything between the code in this repo and Pluck being live, in order. Each line is a human step.

## Before anything ships

- [x] Push the repo to GitHub (`codu-code/pluck`, private until launch) and fill the repo links.
- [x] Licences: AGPL-3.0 for the server, MIT for the clients and shared schemas (in `site.ts` and every package.json). Add the LICENSE files before the repo goes public.
- [ ] Fill the legal placeholders left on Privacy and Terms: `[DATE]`, `[LEGAL ENTITY]`, `[ADDRESS]`, `[RESPONSE DAYS]`. `pnpm test` lists every placeholder left (`scripts/placeholders.test.ts`).
- [ ] Record the 20-second clip for `[CONNECTOR GIF]` (Settings, AI tools).
- [ ] Design pass on `docs/design-gaps.md`: screens with no board, departures from the boards.

## Hosted service

- [ ] Atlas user, CDK deploy, DNS, SES production access, Vercel project and env: `docs/deploy.md`, sections 1 to 3.
- [ ] The checks in `docs/deploy.md`, section 4.
- [ ] Set `ADMIN_EMAILS` and `ABUSE_EMAIL`, and check `/admin` opens for you.
- [ ] Atlas backups are on for the cluster (they are for the existing one; confirm the `pluck` database is included).

## Browser extension

- [ ] Load it unpacked once and go through `docs/loop/BLOCKED.md` (slice 14).
- [ ] `pnpm --filter @pluck/extension zip`, and for Firefox `pnpm --filter @pluck/extension build:firefox` then `wxt zip -b firefox --mv3`.
- [ ] Chrome Web Store listing: description, screenshots, a 30-second video, privacy policy `https://getpluck.io/privacy`, data-use answers (the page you pluck and its address go to your own Pluck server; nothing else, no selling, no ads).
- [ ] Firefox Add-ons listing, same answers (id `extension@getpluck.io`).
- [ ] Fill `[CHROME STORE URL]` and `[FIREFOX ADDONS URL]` in `apps/web/lib/site.ts` once the listings are live.

## iPhone

- [ ] Apple developer team in Xcode or EAS for both targets (app and share extension); App Group `group.io.getpluck.app` and Keychain group `io.getpluck.shared` on both.
- [ ] The manual checklist in `docs/ios.md`, on a phone.
- [ ] App Store Connect: privacy labels (email; content you pluck; no tracking), the privacy policy URL, a permanent demo account for review (with a pk_live key or a mailbox you can read), in-app account deletion (Settings opens it on the web), screenshots.
- [ ] Expect one Guideline 2.1 round. If review objects to "Open Pluck to sign in" in the share extension, change it to a line of text (see `docs/ios.md`).
- [ ] Stopgap until approval: an iOS Shortcut named "Pluck" that posts the shared URL with an API key.
- [ ] Fill `[APP STORE URL]` once live.

## AI tools

- [ ] Publish the stdio bridge: `pnpm --filter @pluck/mcp build`, then `npm publish --access public` from `packages/mcp-stdio` (package `@pluck/mcp`).
- [ ] Add `https://getpluck.io/mcp` in Claude (web and desktop), ChatGPT, Claude Code and Cursor, and run each of the four prompts once.

## Day one

- [ ] Watch the Vercel logs and the cron for errors for the first hours; `docs/deploy.md` says what healthy looks like.
- [ ] Try the home page paste box signed out, sign up, and see the link in the Inbox.
