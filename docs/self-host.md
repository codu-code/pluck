# Self-host Pluck

Pluck runs as one Docker image (the web app, and the same image again as the worker), MongoDB, and an S3-compatible blob store. `docker-compose.yml` at the root of the repo brings all of it up.

## Try it

```sh
git clone https://github.com/codu-code/pluck && cd pluck
docker compose up -d
```

Open http://localhost:3000 and sign in. Sign-in is by email link; until you set up real mail, the links land in the bundled Mailpit at http://localhost:8025.

That is all it takes on one machine. The first start pulls the image (`ghcr.io/codu-code/pluck`, for amd64 and arm64, so an ARM machine needs no build), makes the blob bucket, starts a single-node MongoDB replica set, and generates a secret for sessions, which it keeps in a volume.

Until the first [release](https://github.com/codu-code/pluck/releases) is out there is no image to pull, so build it from the checkout (a few minutes): `docker compose up -d --build`. Compose does the same by itself whenever the pull fails; `docker compose up -d --no-build` stops there instead.

## Put it on a server

Make an `.env` next to `docker-compose.yml` (Compose reads it), put a reverse proxy with HTTPS in front, and set:

| Variable | What | Default |
|---|---|---|
| `PLUCK_URL` | The public address, no trailing slash. Becomes the sign-in link host, the OAuth issuer and the connector URL (`<PLUCK_URL>/mcp`) | `http://localhost:3000` |
| `PLUCK_VERSION` | The release to run, e.g. `0.1.0` (the tag without its `v`), or `0.1` for the newest in that line. Set it to stay on a version until you choose to move | `latest` |
| `PLUCK_PORT` | Host port for the web app, on 127.0.0.1 only, for your proxy | `3000` |
| `MINIO_PORT`, `MAILPIT_PORT` | Host ports for MinIO and Mailpit's inbox, on 127.0.0.1 only | `9000`, `8025` |
| `BETTER_AUTH_SECRET` | 32+ random bytes. Leave unset to have one generated and kept in the `secrets` volume | generated |
| `DIGEST_SECRET` | Optional: a separate key for the Monday email's one-tap links, so you can revoke them without signing everyone out | `BETTER_AUTH_SECRET` |
| `SMTP_URL` | Your mail relay, e.g. `smtps://user:pass@smtp.example.com:465` | the bundled Mailpit |
| `EMAIL_FROM` | The From line for sign-in links and the Monday email | `Pluck <pluck@localhost>` |
| `DIGEST_FROM`, `EMAIL_REPLY_TO` | Optional: a separate From line for the Monday email (a subdomain keeps spam reports on it away from sign-in links), and where replies go if your From address takes no mail | `EMAIL_FROM`, none |
| `S3_PUBLIC_ENDPOINT` | Where browsers and phones reach the blob store (uploads, covers, exports). Publish MinIO behind your proxy and put its public address here | `http://localhost:9000` |
| `S3_ACCESS_KEY`, `S3_SECRET_KEY` | MinIO's credentials, used by the app too. Set the secret to a long random value (`openssl rand -hex 32`): the default is public, so Pluck will not start with it unless `PLUCK_URL` and `S3_PUBLIC_ENDPOINT` are both localhost | `pluck`, `pluck-change-me` |
| `S3_ENDPOINT`, `S3_BUCKET`, `AWS_REGION` | To use real S3 (or R2, B2, …) instead of the bundled MinIO. `S3_BUCKET` on its own names the bundled MinIO's bucket; pick it before the first start, since files are not moved to a new one | MinIO, `pluck-content` |
| `SIGNUP_EMAILS` | Who may start an account, comma separated: full addresses (`ana@example.com`) or whole domains (`@example.com`). Anyone else gets no sign-in email and no account; accounts that already exist keep signing in. Leave unset and anyone who can reach the server can sign up | open |
| `ADMIN_EMAILS` | Who can open `/admin` (reports, take-downs), comma separated | none |
| `ABUSE_EMAIL` | Where reports of public lists are emailed | none |
| `APPLE_TEAM_ID` | Only if you build the iPhone app for your own server: your Apple team ID, so links to your server open the app (universal links). The app needs `applinks:<your host>` too | off |
| `NEXT_PUBLIC_POSTHOG_KEY`, `POSTHOG_HOST` | Your own PostHog project, if you want analytics and error tracking. The key is read when the image is built and the published image has none, so with it in the environment start and update with `docker compose up -d --build`; unset, there is no cookie banner and nothing is sent anywhere. The host defaults to PostHog's EU cloud. What is sent: [analytics.md](analytics.md) | off |
| `WELCOME_FROM` | A From line for a welcome note sent 27 minutes after each sign-up, signed by the person who runs getpluck.io. Leave it unset on your own server | off |
| `REVIEW_EMAIL`, `REVIEW_PASSWORD` | Only if you submit your own build of the iPhone app to App Review: the one address that signs in with a password instead of an email link or code (it gets no email). Leave both unset | off |
| `EMAIL_IN_DOMAIN` | For email-in: the domain whose mail lands in the bucket under `inbound/` (needs an inbound mail service that writes raw messages there, like SES receipt rules) | off |

Never set `ALLOW_PRIVATE_FETCH` or `AUTH_RATE_LIMIT` on a server: they exist for local development and tests only. Without them Pluck refuses to fetch private addresses and rate-limits sign-in.

Rate limits key on the caller's address, which Pluck reads from `X-Forwarded-For`. Your proxy must set that header to the one address it saw, not pass on whatever the client sent. Caddy's `reverse_proxy` does this by default. In nginx, use `proxy_set_header X-Forwarded-For $remote_addr;`, not `$proxy_add_x_forwarded_for`.

Update with `git pull && docker compose pull && docker compose up -d`: the newest `docker-compose.yml`, then the newest release, or the one `PLUCK_VERSION` names. Nothing moves to a newer image until you pull.

Building from the checkout still works, for a change of your own or for `main` ahead of the last release: `git pull && docker compose up -d --build`. The build takes the published image's name on your machine, and the next `docker compose pull` puts the published one back. If you ran Pluck before there were releases, your image was `pluck:local`; it is no longer used, and `docker image rm pluck:local` frees the space.

Back up the `mongo`, `minio` and `secrets` volumes (or set `BETTER_AUTH_SECRET` yourself and keep it somewhere safe). Without the secret a restored server signs everyone out: every session and every connected app and AI tool has to sign in again.

## Apps and AI tools against your server

- **Browser extension:** the store extension only reaches getpluck.io (one host permission keeps its review short), so build one for your server: `PLUCK_SERVER=<PLUCK_URL> pnpm --filter @pluck/extension build`, then `chrome://extensions`, Developer mode, Load unpacked, `apps/extension/.output/chrome-mv3`. It signs in through your server, or takes an API key (Settings, API keys).
- **iPhone:** open `pluck://signin?server=<PLUCK_URL>` on the phone (from a note or your server's Settings) and the sign-in screen opens on "Use your own server" with your address filled in. Store builds hide that choice otherwise; a build with `PLUCK_SHOW_SERVER=1` always shows it. To build and sign the app yourself, change our identifiers to your own first, since Apple lets one team hold each: the bundle ID `io.getpluck.app` (and `.share`), the App Group `group.io.getpluck.app` and the Keychain group `io.getpluck.shared`, in `apps/ios/app.config.ts`, `apps/ios/targets/share/PluckClient.swift`, `apps/ios/lib/data.ts` and `apps/web/app/.well-known/apple-app-site-association/route.ts`.
- **AI tools:** the connector is `<PLUCK_URL>/mcp`, with OAuth like the hosted service. For a tool that only speaks stdio, or a server without public HTTPS: `npx @getpluck/mcp --server <PLUCK_URL> --key pk_live_…`. See `docs/mcp.md`.

## What runs where

- `web`: `next start` on port 3000. Health at `/api/health`.
- `worker`: starts once `web` is healthy, so the two never make a secret each on the first start. The job queue (reading pages, imports, exports, shared files, email-in, welcome notes and the Monday email, together at 8 a second) and the schedule (the nightly move to the Archive, the Monday email, emptying the bin). On Vercel a cron tick does the same; here it is a loop.
- `mongo`: MongoDB 8.2, a single-node replica set.
- `minio` and `minio-init`: the blob store and a one-off that makes the bucket.
- `mailpit`: catches mail until `SMTP_URL` points elsewhere. Remove it once you do.

Minimum: 1 vCPU and 1 GB of RAM for all of it.
