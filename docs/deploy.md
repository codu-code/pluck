# Deploy getpluck.io

The hosted service: the Next.js app and its cron worker on **Vercel** (Pro, for the one-minute cron), the domain and its DNS on **Vercel**, the database on **MongoDB Atlas**, and blobs and email on **AWS** (S3 and SES in eu-west-1, defined in `infra/cdk`). Every step here is a human step; nothing in the repo deploys by itself.

## 1. MongoDB Atlas

1. In the existing cluster, add a database user `pluck-app` with the built-in role **readWrite on the `pluck` database only**.
2. Network access: Vercel functions have no fixed IPs. Either use the Atlas integration for Vercel, or allow `0.0.0.0/0` with the strong password and TLS the connection string already uses.
3. The connection string, with the database name: `mongodb+srv://pluck-app:<password>@<cluster>/pluck?retryWrites=true&w=majority`. Indexes are created by the app on first use.

## 2. AWS (CDK)

```sh
cd infra/cdk
pnpm exec cdk bootstrap aws://<ACCOUNT>/eu-west-1      # once per account and region
pnpm exec cdk diff -c alertEmail=<you>
pnpm exec cdk deploy --all -c alertEmail=<you> --outputs-file cdk-outputs.json   # add -c monthlyBudgetUsd=<n> to change the $50 budget, or 0 in an account inside AWS Organizations whose payer has not enabled budgets
```

The address for alarms is passed at deploy time so it never lands in the repo. The four stacks:

- **PluckEmail:** the SES domain identity for getpluck.io with DKIM, a custom MAIL FROM (`mail.getpluck.io`), and DMARC, plus two sending subdomains with their own DKIM and MAIL FROM: `notify.getpluck.io` (sign-in links, shared Lists, report alerts) and `updates.getpluck.io` (the Monday email). Each keeps its own reputation, so a spam report on the Monday email never reaches sign-in links or the root domain your own mail uses. Outputs the DNS records.
- **PluckData:** the `pluck-content` bucket (eu-west-1, Infrequent Access after 90 days, `inbound/` expires after 7 days, CORS PUT from the app origin) and the IAM user `pluck-app` with access to the bucket and permission to send from the identity. Its secret key goes to Secrets Manager as `pluck/app-user`, never to an output.
- **PluckInbound:** the receipt rule set `pluck-inbound` that writes mail for `in.getpluck.io` (scanned for spam and viruses) to the bucket under `inbound/`.
- **PluckAlerts:** emails the alert address when SES bounces pass 4% or complaints pass 0.08% (AWS reviews an account at 5% and 0.1%, and can pause sending, which stops sign-in), and when the month's AWS cost passes 80% of the budget or is forecast to pass it.

Then:

1. **DNS on Vercel.** Add every `Dns*` output to the domain: `node scripts/vercel-dns.mjs infra/cdk/cdk-outputs.json getpluck.io` prints the `vercel dns add` commands; add `--apply` to run them with your Vercel login. The domain belongs to the `codu` team: run `vercel switch codu` first, or every add is refused with `permission_denied`.
2. **Activate the receipt rule set** (CloudFormation cannot): run the `ActivateRuleSet` output.
3. **SES out of the sandbox:** in the SES console, request production access for eu-west-1 (transactional mail: sign-in links and a weekly digest people opt into). Until then SES only sends to verified addresses.
4. **Confirm the alert subscription:** AWS emails the alert address a link; alarms reach it only after you click it.
5. **The app's keys:** `aws secretsmanager get-secret-value --secret-id pluck/app-user --region eu-west-1` gives the access key id and secret for Vercel.

## 3. Vercel

1. New project from the repo. Root directory `apps/web`; framework Next.js; Node 22. Install command `pnpm install --frozen-lockfile`; build command `pnpm --filter @pluck/web build`.
2. `apps/web/vercel.json` pins functions to `dub1` (next to eu-west-1) and runs `/api/worker/tick` every minute (needs Pro).
3. Environment variables (Production):

| Variable | Value |
|---|---|
| `MONGODB_URI` | the Atlas string from step 1 |
| `BETTER_AUTH_URL` | `https://getpluck.io` (no trailing slash; it is the OAuth issuer and the connector's audience) |
| `BETTER_AUTH_SECRET` | 32+ random bytes (`openssl rand -base64 32`) |
| `EMAIL_FROM` | `Pluck <no-reply@notify.getpluck.io>`: sign-in links (sent with no Reply-To) and shared Lists. Switch to it only once SES shows `notify.getpluck.io` as verified, or sign-in links stop sending |
| `DIGEST_FROM` | `Pluck <weekly@updates.getpluck.io>`, once `updates.getpluck.io` is verified. Unset, the Monday email goes from `EMAIL_FROM` |
| `EMAIL_REPLY_TO` | `niall@getpluck.io`: a real mailbox, since the sending subdomains receive no mail |
| `WELCOME_FROM` | `Niall at Pluck <niall@getpluck.io>`: the welcome note, sent once 27 minutes after sign-up, from a real mailbox (replies come to you). Leave it off and no welcome is sent |
| `AWS_REGION` | `eu-west-1` |
| `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` | from `pluck/app-user` |
| `S3_BUCKET` | the `BucketName` output |
| `CRON_SECRET` | random; Vercel sends it to the cron route |
| `DIGEST_SECRET` | random (optional; a separate key lets you revoke digest links without signing everyone out) |
| `ADMIN_EMAILS` | your address |
| `ABUSE_EMAIL` | the abuse inbox |
| `EMAIL_IN_DOMAIN` | `in.getpluck.io` |
| `APPLE_TEAM_ID` | the Apple Developer team ID that signs the iPhone app (Membership details). Serves `/.well-known/apple-app-site-association`, so links to `/shared/…`, `/lists/…` and `/items/…` open the app when it is installed |
| `NEXT_PUBLIC_POSTHOG_KEY` | the PostHog project token (EU project). Read at build time. Turns on the cookie banner, usage analytics after a yes, and error tracking for the browser and the server |
| `REVIEW_EMAIL`, `REVIEW_PASSWORD` | the App Review account: an address nobody can guess (`apple-review-$(openssl rand -hex 4)@getpluck.io`) and a password (`openssl rand -base64 18`). See "The App Review account" below |

Leave `NEXT_PUBLIC_POSTHOG_KEY` off Preview, so previews never report into the real project. In PostHog, turn on Error tracking (Project settings, Error tracking) and keep Session replay off: Pluck never sends recordings.

Do not set `SMTP_URL`, `S3_ENDPOINT`, `S3_PUBLIC_ENDPOINT`, `ALLOW_PRIVATE_FETCH` or `AUTH_RATE_LIMIT` in production.

Preview deployments build every PR, and the build reads the database, so set `MONGODB_URI` (a separate preview database, never production's) and `BETTER_AUTH_SECRET` for the Preview environment too, or every preview fails at "Collecting page data".

4. Domain: add `getpluck.io` to the project as the primary domain. Keep `/.well-known/*` and `/mcp` free of apex-to-www redirects (AI tools do not follow them during sign-in).
5. Firewall (Project, Firewall): add a rate-limit rule on paths starting `/api/auth/`, 60 requests a minute per IP, action Deny. The app limits sign-in on its own; this rule turns a flood away before it costs a function run.

## 4. After the first deploy

- Sign in on getpluck.io with your address (proves SES and the database).
- `curl https://getpluck.io/.well-known/oauth-protected-resource/mcp` names `https://getpluck.io/mcp`.
- Add the connector in an AI tool (see `docs/mcp.md`) and ask "what did I pluck this week?".
- Forward a newsletter to your `pluck+…@in.getpluck.io` address (Settings, Email-in); it lands within a minute.
- Watch the Vercel cron log for `/api/worker/tick` returning 200 every minute.
- The JWKS (the `jwks` collection) signs every connector token: never delete it.

## The App Review account

Store reviewers (Apple's App Review, Google Play's, the Chrome Web Store's) need a username and password and cannot open an email link, so one static review account serves all of them. Keep its address unguessable (`review-<random>@getpluck.io`) and keep the address and password outside the repo, with whoever submits the builds. With `REVIEW_EMAIL` and `REVIEW_PASSWORD` set, that one address signs in with a password and no other can: typing it on the sign-in page on the web (which is also where the Chrome extension signs in) and tapping "Email me a link", or in the iPhone app and tapping "Send my code", shows a Password field instead of sending anything. The account is made at the first password sign-in, and changing `REVIEW_PASSWORD` changes the password at the next one. Pluck sends no email to the address, and nobody can sign up, reset or change a password.

- Give App Store Connect (App Review Information, Sign-in required) the two values, with the note: "Type the email, tap Email me a link, then type the password."
- Sign in as the account once before submitting and pluck a few real links, a Note and a Todo, tag two and make a List, so the reviewer sees a library and not an empty Inbox. `scripts/demo-seed.mjs` cannot do this: it needs Mailpit and the local fixture pages, so it only fills a local server.
- Unset both to turn it off. The account and its library stay; nothing is deleted.

## Publishing @getpluck/mcp

The stdio bridge (`packages/mcp-stdio`) goes to npm from `.github/workflows/publish-mcp.yml`, never from a laptop. People hand it their `pk_live_` key, and a release built by the workflow carries npm provenance: its npm page links the exact commit and workflow run it was built from. The workflow holds no npm token. npm trusts it by name (trusted publishing), and with `publishConfig.provenance` in the package, npm refuses a publish from anywhere that cannot sign one.

Once, on npmjs.com, as an owner of the `@getpluck` scope:

1. Open the `@getpluck/mcp` package, Settings, Trusted Publisher, GitHub Actions. Organization or user `codu-code`, repository `pluck`, workflow filename `publish-mcp.yml`, environment left empty. Save.
2. On the same page, Publishing access: choose "Require two-factor authentication and disallow tokens".
3. In your account's Access Tokens, revoke any token that could publish. The repo needs no `NPM_TOKEN` secret; do not add one.

Each release:

1. Raise `version` in `packages/mcp-stdio/package.json` in a pull request and merge it. 0.1.0 went up by hand, so the first release from the workflow is the next version.
2. Tag that commit on `main` and push the tag: `git tag mcp-v<version> && git push origin mcp-v<version>`. The workflow stops if the tag and the version differ.
3. Watch the run in Actions, then `npm view @getpluck/mcp version`, and look for the provenance on the package's npm page.

Anyone who can push a tag named `mcp-v*` can publish. A tag ruleset (Settings, Rules) keeps that to maintainers.

## Cutting a release

A release is for people who run their own Pluck. A tag `v<version>` on `main` runs `.github/workflows/release.yml`, which builds the Docker image for amd64 and arm64, pushes it to `ghcr.io/codu-code/pluck` as `<version>`, `<major>.<minor>` and `latest`, signs a record of the commit and run it was built from, and creates the GitHub release with that version's section of `CHANGELOG.md` as its notes. `docker compose up -d` pulls that image (`docs/self-host.md`). It is built with no build arguments, so it holds no analytics key and no address. A release changes nothing on getpluck.io, which deploys from `main`.

Each release (0.1.0 here):

1. In a pull request, give the version its dated section in `CHANGELOG.md` and merge it. For 0.1.0 the section is written: change `## [0.1.0] - Unreleased` to `## [0.1.0] - <today, as YYYY-MM-DD>` and move anything under `## [Unreleased]` into it. For later versions, add `## [X.Y.Z] - YYYY-MM-DD` under `## [Unreleased]` and move its lines down. `## [Unreleased]` stays on top, empty.
2. Tag that commit on `main` and push the tag:

   ```sh
   git switch main && git pull
   git tag v0.1.0 && git push origin v0.1.0
   ```

3. Watch the run in Actions, or `gh run watch` and pick Release. It reads the changelog before it builds anything: with no dated section for the version it stops there and nothing is published. Fix the changelog on `main`, then move the tag (`git push origin :refs/tags/v0.1.0`, `git tag -f v0.1.0`, push it again). The arm64 half is built under emulation and is the slow part.
4. Check what came out:

   ```sh
   gh release view v0.1.0
   docker buildx imagetools inspect ghcr.io/codu-code/pluck:0.1.0     # linux/amd64 and linux/arm64
   gh attestation verify oci://ghcr.io/codu-code/pluck:0.1.0 --repo codu-code/pluck
   ```

Once, after the first release: a package pushed by a workflow starts private, and until it is public nobody else can pull it (their `docker compose up -d` builds from the checkout instead). On GitHub, open the `codu-code` organisation, Packages, `pluck`, Package settings:

1. Danger Zone, Change visibility, Public. This cannot be undone. If Public is not offered, allow public container packages first (the organisation's Settings, Packages).
2. The package should already name `codu-code/pluck` as its repository, since the workflow's token and the image's source label link it. If it does not, use Connect repository on the package's page.
3. Signed out, from any machine: `docker logout ghcr.io && docker pull ghcr.io/codu-code/pluck:latest`.

To try the build without publishing anything, once the workflow is on `main`: `gh workflow run release.yml -f push=false` builds both architectures and pushes nothing. With `push=true` it publishes, and only when run from a tag (`--ref v0.1.0`).

Anyone who can push a tag named `v*.*.*` can publish. A tag ruleset (Settings, Rules) keeps that to maintainers.

## Rotating the storage key

The app reaches S3 and SES as the IAM user `pluck-app` with one long-lived access key: the `AppUserKey` resource in `infra/cdk/lib/data-stack.ts`, kept in Secrets Manager as `pluck/app-user`. Rotate it once a year, when someone who could read it leaves, and straight away if it may have leaked.

The stack owns exactly one key, and CloudFormation deletes the old one at the end of the deploy that makes the new one. From then until step 4 is done, uploads, covers, exports and every email (sign-in links too) fail. That is a few minutes: pick a quiet hour and have Vercel open first.

1. In `data-stack.ts`, give the key a serial, or raise the one it has by one: `new iam.AccessKey(this, "AppUserKey", { user, serial: 1 })`. The number only goes up. Merge it as its own pull request; merging changes nothing in AWS.
2. From `infra/cdk`: `pnpm exec cdk diff PluckData -c alertEmail=<you>` should show the access key replaced and the secret changed, and nothing else. Then `pnpm exec cdk deploy PluckData -c alertEmail=<you>`.
3. `aws secretsmanager get-secret-value --secret-id pluck/app-user --region eu-west-1` gives the new pair. In Vercel (Project, Settings, Environment Variables) replace `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` for Production, and anywhere else you set them.
4. Redeploy production (Deployments, the current one, Redeploy): a deployment keeps the values it started with.
5. Check: sign in on getpluck.io (SES) and upload a file (S3). `aws iam list-access-keys --user-name pluck-app` shows one key, created today. The old key is already gone; there is nothing to delete by hand.

Do not make a second key by hand with `aws iam create-access-key` to avoid the gap: CloudFormation does not know about it, and with two keys on the user (IAM's limit) the next rotation by the stack fails.

## Later

Move the worker off Vercel cron (one Fargate task running `pnpm --filter @pluck/web worker` from the same `Dockerfile`) if long imports or extraction start hitting the 60-second function limit.
