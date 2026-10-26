---
title: Draai je eigen Pluck.
description: Eén docker compose, 1 GB RAM en dezelfde app op je eigen server. Alles, de lastige stukken inbegrepen.
keywords: read later zelf hosten, self-hosted Pocket alternatief, read later docker, bladwijzerbeheer zelf hosten, open source read later server
---

Pluck op getpluck.io is gratis. Dezelfde code draait op je eigen server, en starten is één commando.

Hier is alles, de lastige stukken inbegrepen.

![Een terminal die Pluck start, en dezelfde Inbox op het adres van een thuisserver.](/blog/run-your-own-pluck/hero.png)

## Wat je nodig hebt

Docker, en een machine met 1 vCPU en 1 GB RAM. Een kleine VPS, een oude laptop of het kastje onder de tv: het werkt allemaal.

## Start het

```
git clone https://github.com/codu-code/pluck
cd pluck
docker compose up -d
```

Open http://localhost:3000. Pluck logt je in met een link per e-mail, en bij een verse installatie gaat die mail naar de ingebouwde mailvanger op http://localhost:8025. Je hebt geen mailserver nodig om het te proberen.

## Wat er draait

Eén Docker-image, twee keer gestart. De ene kopie serveert de app. De andere is de worker, die pagina’s leest, niet-aangeraakte items ’s nachts naar het Archief verplaatst, de maandagmail verstuurt en de Prullenbak leegt.

Ernaast: MongoDB voor je bibliotheek, MinIO voor bewaarde pagina’s en bestanden, en Mailpit om e-mail op te vangen.

## Zet het op een echt adres

Zet er een reverse proxy met HTTPS voor, en zet dan deze waarden in een `.env`-bestand naast het compose-bestand:

- `PLUCK_URL`, het adres dat je gaat gebruiken.
- `SMTP_URL` en `EMAIL_FROM`, zodat inlogmails echte inboxen bereiken.
- `S3_ACCESS_KEY` en `S3_SECRET_KEY`, in plaats van de standaardwaarden.

Pluck start niet op een openbaar adres met het standaardwachtwoord voor de opslag. Dat is met opzet. De [handleiding voor zelf hosten](https://github.com/codu-code/pluck/blob/main/docs/self-host.md) noemt elke instelling.

## Laat je apps ernaar wijzen

- **iPhone.** Open `pluck://signin?server=https://your.address` op de telefoon. De app logt dan in bij jouw server.
- **Chrome.** De extensie uit de store praat alleen met getpluck.io. Bouw je eigen met `PLUCK_SERVER=https://your.address pnpm --filter @pluck/extension build` en laad hem als uitgepakte extensie.
- **Je AI.** Verbind hem met `https://your.address/mcp`. Heeft de server geen openbaar adres, maak dan een API-sleutel in Instellingen en gebruik `npx @pluck/mcp --server https://your.address --key pk_live_…`.

## De lastige stukken

E-mail naar Pluck heeft een dienst nodig die mail voor je domein ontvangt en in de opslag zet. Het compose-bestand bevat er geen, dus de handleiding legt uit wat je moet instellen.

Back-ups maak je zelf. Maak back-ups van de volumes `mongo` en `minio`. Dat is je hele bibliotheek.

## Upgrades

```
git pull && docker compose up -d --build
```

De server is AGPL-3.0 en de apps zijn MIT.

Stoppen wij ooit, dan stop jij niet.
