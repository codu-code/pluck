---
title: Betreib dein eigenes Pluck.
description: Ein docker compose, 1 GB RAM und dieselbe App auf deinem eigenen Server. Alles davon, die unbequemen Teile inklusive.
keywords: später lesen selbst hosten, selbst gehostete Pocket Alternative, später lesen Docker, Lesezeichen Manager selbst hosten, Open Source Read-later Server
---

Pluck auf getpluck.io ist kostenlos. Derselbe Code läuft auf deinem eigenen Server, und gestartet ist er mit einem Befehl.

Hier ist alles, die unbequemen Teile inklusive.

![Ein Terminal startet Pluck, und derselbe Eingang läuft unter der Adresse eines Heimservers.](/blog/run-your-own-pluck/hero.png)

## Was du brauchst

Docker und eine Maschine mit 1 vCPU und 1 GB RAM. Ein kleiner VPS, ein alter Laptop oder die Kiste unterm Fernseher, alles geht.

## Starten

```
git clone https://github.com/codu-code/pluck
cd pluck
docker compose up -d
```

Öffne http://localhost:3000. Pluck meldet dich mit einem Link per E-Mail an, und bei einer frischen Installation landet diese E-Mail im eingebauten Mail-Fänger unter http://localhost:8025. Zum Ausprobieren brauchst du keinen Mailserver.

## Was läuft

Ein Docker-Image, zweimal gestartet. Eine Kopie liefert die App aus. Die andere ist der Worker: Er liest Seiten, schiebt unberührte Einträge über Nacht ins Archiv, verschickt die Montagsmail und leert den Papierkorb.

Daneben: MongoDB für deine Bibliothek, MinIO für behaltene Seiten und Dateien und Mailpit, das E-Mails abfängt.

## Auf eine echte Adresse

Stell einen Reverse Proxy mit HTTPS davor und setz dann diese Werte in einer `.env`-Datei neben der Compose-Datei:

- `PLUCK_URL`, die Adresse, die du nutzen wirst.
- `SMTP_URL` und `EMAIL_FROM`, damit Anmelde-E-Mails in echten Postfächern ankommen.
- `S3_ACCESS_KEY` und `S3_SECRET_KEY`, anstelle der Standardwerte.

Pluck startet auf einer öffentlichen Adresse nicht mit dem Standard-Passwort für den Speicher. Das ist Absicht. Die [Anleitung zum Selbsthosten](https://github.com/codu-code/pluck/blob/main/docs/self-host.md) listet jede Einstellung auf.

## Deine Apps darauf richten

- **iPhone.** Öffne `pluck://signin?server=https://your.address` auf dem Handy. Die App meldet sich dann bei deinem Server an.
- **Chrome.** Die Erweiterung aus dem Store spricht nur mit getpluck.io. Bau deine eigene mit `PLUCK_SERVER=https://your.address pnpm --filter @pluck/extension build` und lade sie mit „Entpackte Erweiterung laden“.
- **Deine KI.** Verbinde sie mit `https://your.address/mcp`. Wenn der Server keine öffentliche Adresse hat, leg in den Einstellungen einen API-Schlüssel an und nutze `npx @pluck/mcp --server https://your.address --key pk_live_…`.

## Die unbequemen Teile

Per E-Mail pflücken braucht einen Dienst, der Mail für deine Domain empfängt und im Speicher ablegt. Die Compose-Datei bringt keinen mit, also erklärt die Anleitung, was du einrichten musst.

Die Backups machst du. Sichere die Volumes `mongo` und `minio`. Das ist deine ganze Bibliothek.

## Upgrades

```
git pull && docker compose up -d --build
```

Der Server steht unter AGPL-3.0, die Apps unter MIT.

Hören wir je auf, machst du einfach weiter.
