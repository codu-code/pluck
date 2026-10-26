---
title: Il tuo Pluck, sul tuo server.
description: Un docker compose, 1 GB di RAM e la stessa app sul tuo server. Tutto quanto, comprese le parti scomode.
keywords: read it later self-hosted, alternativa a Pocket self-hosted, read it later docker, gestore di segnalibri self-hosted, server read it later open source
---

Pluck su getpluck.io è gratis. Lo stesso codice gira sul tuo server, e per avviarlo basta un comando.

Ecco tutto quanto, comprese le parti scomode.

![Un terminale che avvia Pluck, e la stessa Inbox che gira all'indirizzo di un server di casa.](/blog/run-your-own-pluck/hero.png)

## Cosa ti serve

Docker, e una macchina con 1 vCPU e 1 GB di RAM. Una piccola VPS, un vecchio portatile o la scatoletta sotto la TV vanno tutti bene.

## Avvialo

```
git clone https://github.com/codu-code/pluck
cd pluck
docker compose up -d
```

Apri http://localhost:3000. Pluck ti fa accedere con un link via email, e su un'installazione nuova quell'email finisce nella casella di prova integrata su http://localhost:8025. Per provarlo non serve un server di posta.

## Cosa gira

Un'immagine Docker, avviata due volte. Una copia serve l'app. L'altra è il worker, che legge le pagine, di notte sposta nell'Archivio gli elementi non toccati, manda l'email del lunedì e svuota il Cestino.

Accanto a loro: MongoDB per la tua libreria, MinIO per le pagine conservate e i file, e Mailpit per raccogliere le email.

## Mettilo su un indirizzo vero

Metti davanti un reverse proxy con HTTPS, poi imposta questi valori in un file `.env` accanto al file compose:

- `PLUCK_URL`, l'indirizzo che userai.
- `SMTP_URL` ed `EMAIL_FROM`, così le email di accesso arrivano in caselle vere.
- `S3_ACCESS_KEY` e `S3_SECRET_KEY`, al posto di quelli predefiniti.

Pluck non parte su un indirizzo pubblico con la password di storage predefinita. È voluto. La [guida al self-hosting](https://github.com/codu-code/pluck/blob/main/docs/self-host.md) elenca ogni impostazione.

## Collega le tue app

- **iPhone.** Apri `pluck://signin?server=https://your.address` sul telefono. L'app accede al tuo server.
- **Chrome.** L'estensione dello store parla solo con getpluck.io. Compila la tua con `PLUCK_SERVER=https://your.address pnpm --filter @pluck/extension build` e caricala con "Carica estensione non pacchettizzata".
- **La tua IA.** Collegala a `https://your.address/mcp`. Se il server non ha un indirizzo pubblico, crea una chiave API in Impostazioni e usa `npx @pluck/mcp --server https://your.address --key pk_live_…`.

## Le parti scomode

L'email in entrata richiede un servizio che riceva la posta per il tuo dominio e la depositi nello storage. Il file compose non ne include uno, quindi la guida spiega cosa configurare.

I backup li fai tu. Fai il backup dei volumi `mongo` e `minio`. Lì c'è tutta la tua libreria.

## Aggiornamenti

```
git pull && docker compose up -d --build
```

Il server è AGPL-3.0 e le app sono MIT.

Se un giorno ci fermiamo noi, tu non ti fermi.
