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

- **PluckEmail:** the SES domain identity for getpluck.io with DKIM, a custom MAIL FROM (`mail.getpluck.io`), and DMARC. Outputs the DNS records.
- **PluckData:** the `pluck-content` bucket (eu-west-1, Infrequent Access after 90 days, `inbound/` expires after 7 days, CORS PUT from the app origin) and the IAM user `pluck-app` with access to the bucket and permission to send from the identity. Its secret key goes to Secrets Manager as `pluck/app-user`, never to an output.
- **PluckInbound:** the receipt rule set `pluck-inbound` that writes mail for `in.getpluck.io` (scanned for spam and viruses) to the bucket under `inbound/`.
- **PluckAlerts:** emails the alert address when SES bounces pass 4% or complaints pass 0.08% (AWS reviews an account at 5% and 0.1%, and can pause sending, which stops sign-in), and when the month's AWS cost passes 80% of the budget or is forecast to pass it.

Then:

1. **DNS on Vercel.** Add every `Dns*` output to the domain: `node scripts/vercel-dns.mjs infra/cdk/cdk-outputs.json getpluck.io` prints the `vercel dns add` commands; add `--apply` to run them with your Vercel login.
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
| `EMAIL_FROM` | `Pluck <hello@getpluck.io>` |
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

## Later

Move the worker off Vercel cron (one Fargate task running `pnpm --filter @pluck/web worker` from the same `Dockerfile`) if long imports or extraction start hitting the 60-second function limit.
