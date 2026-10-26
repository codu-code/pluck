# Launch checklist

Everything between the code in this repo and Pluck being live, in order. Each line is a human step.

## Before anything ships

- [x] Push the repo to GitHub (`codu-code/pluck`, private until launch) and fill the repo links.
- [x] Licence: Apache-2.0 for everything (root `LICENSE` and `NOTICE`, every package.json, `LICENCE` in `site.ts`), with `TRADEMARKS.md` for the name and logo, and a DCO sign-off on every commit (CONTRIBUTING.md, `.github/workflows/dco.yml`).
- [x] Fill the legal placeholders (`pnpm test` lists any left: `scripts/placeholders.test.ts`).
- [ ] Add the registered address of Codú Limited to Privacy once known.
- [x] The connector clip: `ConnectLoop` plays in Settings, AI tools and on Connect your AI (`scripts/record-loop.mjs` records it for socials).
- [ ] Design pass on `docs/design-gaps.md`: screens with no board, departures from the boards.

## Making the repo public

- [x] Settings → General: make `codu-code/pluck` public.
- [x] Settings → Code security: secret scanning and push protection on; Dependabot alerts on; private vulnerability reporting on (`SECURITY.md` links to it).
- [ ] Settings → Branches: protect `main` (pull request required, the DCO check required, no force pushes).
- [ ] Description, topics (`read-it-later`, `mcp`, `self-hosted`, `nextjs`, `bookmarks`) and the social preview image.
- [ ] Tag `v0.1.0` and write its release notes.

## Hosted service

- [ ] Atlas user, CDK deploy, DNS, SES production access, Vercel project and env: `docs/deploy.md`, sections 1 to 3.
- [ ] The checks in `docs/deploy.md`, section 4.
- [ ] Set `ADMIN_EMAILS` and `ABUSE_EMAIL`, and check `/admin` opens for you.
- [ ] Atlas backups are on for the cluster (they are for the existing one; confirm the `pluck` database is included).

## Browser extension

- [x] `pnpm --filter @pluck/extension zip`. (Firefox is not planned for launch; the build still supports it.)
- [x] Chrome Web Store listing: description, screenshots, a 30-second video, privacy policy `https://getpluck.io/privacy`, data-use answers (the page you pluck and its address go to your own Pluck server; nothing else, no selling, no ads).
- [x] Once the listings are live, put the store URL in `CHROME_STORE_URL` (`apps/web/lib/siteUrls.ts`; `/chrome` redirects there).

## iPhone

- [ ] Apple developer team in Xcode or EAS for both targets (app and share extension); App Group `group.io.getpluck.app` and Keychain group `io.getpluck.shared` on both.
- [ ] The manual checklist in `docs/ios.md`, on a phone.
- [ ] App Store Connect: privacy labels (the six types in `docs/ios.md`: email, photos, content you pluck, user ID, usage data after the in-app yes, crash data not linked; no tracking), the privacy policy URL, a permanent demo account for review (with a pk_live key or a mailbox you can read), in-app account deletion (Settings opens it on the web), screenshots.
- [ ] Expect one Guideline 2.1 round. If review objects to "Open Pluck to sign in" in the share extension, change it to a line of text (see `docs/ios.md`).
- [ ] Stopgap until approval: an iOS Shortcut named "Pluck" that posts the shared URL with an API key.
- [ ] TestFlight first. Once the App Store listing is live, put its URL in `APP_STORE_URL` in `apps/web/lib/site.ts` (it points at the `/iphone` coming-soon page until then).

## AI tools

- [x] Publish the stdio bridge under the `@getpluck` scope: `npm login`, then `pnpm publish --access public` from `packages/mcp-stdio` (it builds first). Use pnpm, not npm: only pnpm applies `publishConfig.exports`, so the package points at `dist`, not `src`.
- [ ] Add `https://getpluck.io/mcp` in Claude (web and desktop), ChatGPT, Claude Code and Cursor, and run each of the four prompts once.

## Day one

- [ ] Watch the Vercel logs and the cron for errors for the first hours; `docs/deploy.md` says what healthy looks like.
- [ ] Try the home page paste box signed out, sign up, and see the link in the Inbox.
