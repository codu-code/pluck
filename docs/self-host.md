# Self-host Pluck

Pluck runs as one Docker image (the web app, and the same image again as the worker), MongoDB, and an S3-compatible blob store. `docker-compose.yml` at the root of the repo brings all of it up.

## Try it

```sh
git clone <repo> pluck && cd pluck
docker compose up -d
```

Open http://localhost:3000 and sign in. Sign-in is by email link; until you set up real mail, the links land in the bundled Mailpit at http://localhost:8025.

That is all it takes on one machine. The first start builds the image (a few minutes), makes the blob bucket, starts a single-node MongoDB replica set, and generates a secret for sessions, which it keeps in a volume.

## Put it on a server

Make an `.env` next to `docker-compose.yml` (Compose reads it), put a reverse proxy with HTTPS in front, and set:

| Variable | What | Default |
|---|---|---|
| `PLUCK_URL` | The public address, no trailing slash. Becomes the sign-in link host, the OAuth issuer and the connector URL (`<PLUCK_URL>/mcp`) | `http://localhost:3000` |
| `PLUCK_PORT` | Host port for the web app, on 127.0.0.1 only, for your proxy | `3000` |
| `BETTER_AUTH_SECRET` | 32+ random bytes. Leave unset to have one generated and kept in the `secrets` volume | generated |
| `SMTP_URL` | Your mail relay, e.g. `smtps://user:pass@smtp.example.com:465` | the bundled Mailpit |
| `EMAIL_FROM` | The From line for sign-in links and the Monday email | `Pluck <pluck@localhost>` |
| `DIGEST_FROM`, `EMAIL_REPLY_TO` | Optional: a separate From line for the Monday email (a subdomain keeps spam reports on it away from sign-in links), and where replies go if your From address takes no mail | `EMAIL_FROM`, none |
| `S3_PUBLIC_ENDPOINT` | Where browsers and phones reach the blob store (uploads, covers, exports). Publish MinIO behind your proxy and put its public address here | `http://localhost:9000` |
| `S3_ACCESS_KEY`, `S3_SECRET_KEY` | MinIO's credentials, used by the app too. Set the secret to a long random value (`openssl rand -hex 32`): the default is public, so Pluck will not start with it unless `PLUCK_URL` and `S3_PUBLIC_ENDPOINT` are both localhost | `pluck`, `pluck-change-me` |
| `S3_ENDPOINT`, `S3_BUCKET`, `AWS_REGION` | To use real S3 (or R2, B2, …) instead of the bundled MinIO | MinIO |
| `ADMIN_EMAILS` | Who can open `/admin` (reports, take-downs), comma separated | none |
| `ABUSE_EMAIL` | Where reports of public lists are emailed | none |
| `APPLE_TEAM_ID` | Only if you build the iPhone app for your own server: your Apple team ID, so links to your server open the app (universal links). The app needs `applinks:<your host>` too | off |
| `NEXT_PUBLIC_POSTHOG_KEY`, `POSTHOG_HOST` | Your own PostHog project, if you want analytics and error tracking. The key is read when the image is built (`docker compose build` with it in the environment); unset, there is no cookie banner and nothing is sent anywhere. The host defaults to PostHog's EU cloud | off |
| `WELCOME_FROM` | A From line for a welcome note sent 27 minutes after each sign-up, signed by the person who runs getpluck.io. Leave it unset on your own server | off |
| `EMAIL_IN_DOMAIN` | For email-in: the domain whose mail lands in the bucket under `inbound/` (needs an inbound mail service that writes raw messages there, like SES receipt rules) | off |

Never set `ALLOW_PRIVATE_FETCH` or `AUTH_RATE_LIMIT` on a server: they exist for local development and tests only. Without them Pluck refuses to fetch private addresses and rate-limits sign-in.

Rate limits key on the caller's address, which Pluck reads from `X-Forwarded-For`. Your proxy must set that header to the one address it saw, not pass on whatever the client sent. Caddy's `reverse_proxy` does this by default. In nginx, use `proxy_set_header X-Forwarded-For $remote_addr;`, not `$proxy_add_x_forwarded_for`.

Update with `git pull && docker compose up -d --build`. Back up the `mongo` and `minio` volumes.

## Apps and AI tools against your server

- **Browser extension:** the store extension only reaches getpluck.io (one host permission keeps its review short), so build one for your server: `PLUCK_SERVER=<PLUCK_URL> pnpm --filter @pluck/extension build`, then `chrome://extensions`, Developer mode, Load unpacked, `apps/extension/.output/chrome-mv3`. It signs in through your server, or takes an API key (Settings, API keys).
- **iPhone:** on the sign-in screen, "Use your own server".
- **AI tools:** the connector is `<PLUCK_URL>/mcp`, with OAuth like the hosted service. For a tool that only speaks stdio, or a server without public HTTPS: `npx @pluck/mcp --server <PLUCK_URL> --key pk_live_…`. See `docs/mcp.md`.

## What runs where

- `web`: `next start` on port 3000. Health at `/api/health`.
- `worker`: the job queue (reading pages, imports, exports, shared files, email-in, welcome notes and the Monday email, together at 8 a second) and the schedule (the nightly move to the Archive, the Monday email, emptying the bin). On Vercel a cron tick does the same; here it is a loop.
- `mongo`: MongoDB 8.2, a single-node replica set.
- `minio` and `minio-init`: the blob store and a one-off that makes the bucket.
- `mailpit`: catches mail until `SMTP_URL` points elsewhere. Remove it once you do.

Minimum: 1 vCPU and 1 GB of RAM for all of it.
