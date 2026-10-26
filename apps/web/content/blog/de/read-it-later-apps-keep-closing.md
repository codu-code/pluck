---
title: Später-lesen-Apps machen immer wieder dicht.
description: Pocket ist weg. Omnivore ist weg. Fünf Punkte, die du prüfen solltest, bevor du der nächsten App deine Bibliothek anvertraust.
keywords: Open Source später lesen, später lesen selbst hosten, Pocket Alternative, Wallabag, Karakeep, Linkwarden
---

Omnivore ging im November 2024, mit etwa zwei Wochen Vorlauf. Pocket ging im Juli 2025, mit ein paar Monaten Zeit zum Exportieren. Beide hielten Jahre an Sachen, die Leute eigentlich lesen wollten.

Keine der beiden machte zu, weil ihre Nutzer etwas falsch gemacht hätten. Eine Firma hat entschieden, und die Uhr lief.

Bevor du also der nächsten vertraust, prüf fünf Punkte. Pluck ist die App, die wir machen, und wir messen sie an derselben Liste.

![Eine Bibliothek verlässt eine App als Dateien, die du öffnen kannst: JSON, Markdown, eine CSV und ein ZIP.](/blog/read-it-later-apps-keep-closing/hero.png)

## 1. Kannst du heute alles mitnehmen?

Nicht „Export kommt bald“. Keine E-Mail an den Support. Ein Button, heute, und eine Datei, die du ohne die App öffnen kannst.

Bei Pluck steckt er in den Einstellungen, und ein Link zum ZIP kommt in ein, zwei Minuten per E-Mail. Darin ist jeder Eintrag als JSON, mit deinen Notizen und Markierungen, dazu eine Markdown-Datei für jeden Eintrag und jede Liste. Jede einzelne Liste lässt sich auch auf ihrer eigenen Seite als Markdown herunterladen.

## 2. Behält sie die Seite oder nur den Link?

Ein Link funktioniert nur, solange jemand anders die Seite online hält. Websites ziehen um, verschwinden hinter einer Paywall oder sind einfach weg.

Pluck behält den Seitentext, wenn du pflückst, also ist deine Kopie noch da, wenn die Website es nicht mehr ist. Wenn sich eine Seite nicht lesen lässt, sagt Pluck das und bietet die Wayback-Kopie an.

## 3. Ist der Code öffentlich?

Wenn der Code öffentlich ist, kann die App die Firma überleben. Jemand kann sie forken, und du kannst nachlesen, was sie mit deinen Daten macht.

Pluck ist Open Source unter Apache-2.0, der Server wie die Apps.

Öffentlicher Code ist allerdings nicht die ganze Antwort. Omnivore war auch Open Source.

## 4. Kannst du sie selbst betreiben, ohne ein Wochenende zu verlieren?

Das rettet dich, wenn die Firma verschwindet, also muss eine eigene Kopie etwas ganz Normales sein.

Bei Pluck heißt das `git clone`, dann `docker compose up -d`. Die Web-App, die iPhone-App und deine KI arbeiten alle mit deinem Server, und die Chrome-Erweiterung baust du mit einem weiteren Befehl dafür. Die [Anleitung zum Selbsthosten](https://github.com/codu-code/pluck/blob/main/docs/self-host.md) behandelt Mail, Speicher und die Erweiterung.

## 5. Kommt deine KI zu deinen Bedingungen rein?

Früher oder später willst du, dass deine KI deine Bibliothek durchsucht und sortiert. Die Frage ist, wer das Sagen hat.

Pluck hat keine KI eingebaut. Dein eigenes KI-Tool verbindet sich mit einem Link über MCP, den offenen Standard, und tut, worum du es bittest. Es kann nichts löschen und keine Liste öffentlich machen, und jeder Tag und jede Liste, die es anlegt, ist gekennzeichnet. [Verbinde deine KI](/connect) hat die Details.

## Die anderen

Schau dich ruhig um. Ein paar gute:

- **Wallabag** ist Open Source und gibt es schon lange. Es ist dafür gebaut, auf deinem eigenen Server zu laufen, und es gibt bezahltes Hosting, wenn dir das lieber ist.
- **Karakeep** (früher Hoarder) ist Open Source und selbst gehostet, mit eingebautem KI-Tagging, wenn du ein Modell einrichtest.
- **Linkwarden** ist Open Source und behält Kopien der Seiten, die du ihm gibst.
- **Raindrop**, **Readwise Reader** und **Instapaper** sind ausgefeilt und Closed Source. Beim Schreiben dieses Artikels ist der KI-Konnektor von Raindrop eine Beta im Bezahltarif.

Wo Pluck hingehört: Es ist kostenlos auf getpluck.io, derselbe Code läuft auf deinem eigenen Server, und zu jedem Konto gehört ein KI-Konnektor. Es ist ein Eingang für Artikel, Videos, Notizen, Aufgaben und das Kochfeld, das du dir vielleicht kaufst.

## Wenn du umziehst

Pluck importiert eine Pocket-CSV, ein Omnivore-ZIP, eine Raindrop-CSV und die Lesezeichendatei, die dein Browser exportiert. Alles landet im Archiv, auffindbar, damit dein Eingang leer anfängt. Wenn du einen Pocket-Export behalten hast, [hier ist die Anleitung](/blog/pocket-is-gone). Für Omnivore [diese hier](/blog/omnivore-is-gone).

Pflück es. Sortier es später.
