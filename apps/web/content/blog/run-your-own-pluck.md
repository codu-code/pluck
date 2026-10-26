Pluck at getpluck.io is free. The same code runs on your own server, and it's one command to start.

Here's the whole of it, the awkward parts included.

```image run-your-own-pluck/hero.png
alt: A terminal starting Pluck, and the same Inbox running at a home server address.
1600 × 900 PNG, the hero for a Pluck blog post about self-hosting Pluck with Docker.
Ground: Ground #F6F8F4, flat. Left: a terminal block in Geist Mono, Ink on Surface #EDF0EA, showing "git clone https://github.com/codu-code/pluck", "cd pluck", "docker compose up -d" and four short service lines, each ending "Started": mongo, minio, mailpit, web. Right: the Pluck web app Inbox, light mode, at true size, with the mixed library, at the address "pluck.home.lan". The three sparks from the logo, in Accent #34A07C, pop once between the two.
Rules: no gradients, glows, cards inside cards, one-sided accent borders, pure black, cream or emoji. No logo, no device frame, no extra words.
```

## What you need

Docker, and a machine with 1 vCPU and 1 GB of RAM. A small VPS, an old laptop or the box under the telly all work.

## Start it

```
git clone https://github.com/codu-code/pluck
cd pluck
docker compose up -d
```

Open http://localhost:3000. Pluck signs you in with a link by email, and on a fresh install that email goes to the built-in mail catcher at http://localhost:8025. No mail server needed to try it.

## What's running

One Docker image, started twice. One copy serves the app. The other is the worker, which reads pages, moves untouched items to the Archive overnight, sends the Monday email and empties the bin.

Beside them: MongoDB for your library, MinIO for kept pages and files, and Mailpit to catch email.

## Put it on a real address

Put a reverse proxy with HTTPS in front, then set these in a `.env` file next to the compose file:

- `PLUCK_URL`, the address you'll use.
- `SMTP_URL` and `EMAIL_FROM`, so sign-in emails reach real inboxes.
- `S3_ACCESS_KEY` and `S3_SECRET_KEY`, replacing the defaults.

Pluck won't start on a public address with the default storage password. That's on purpose. The [self-host guide](https://github.com/codu-code/pluck/blob/main/docs/self-host.md) lists every setting.

## Point your apps at it

- **iPhone.** Open `pluck://signin?server=https://your.address` on the phone. The app signs in to your server instead.
- **Chrome.** The store extension only talks to getpluck.io. Build your own with `PLUCK_SERVER=https://your.address pnpm --filter @pluck/extension build` and load it unpacked.
- **Your AI.** Connect it to `https://your.address/mcp`. If the server has no public address, make an API key in Settings and use `npx @pluck/mcp --server https://your.address --key pk_live_…`.

## The awkward parts

Email-in needs a service that receives mail for your domain and drops it into storage. The compose file doesn't include one, so the guide covers what to set up.

You run the backups. Back up the `mongo` and `minio` volumes. That's your whole library.

## Upgrades

```
git pull && docker compose up -d --build
```

The server is AGPL-3.0 and the apps are MIT.

If we ever stop, you don't.
