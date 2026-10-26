---
title: Omnivore ist weg. Die Seiten in deinem ZIP nicht.
description: Wenn du deinen Omnivore-Export behalten hast, liest Pluck die Seiten direkt aus dem ZIP. Auch die, deren Websites verschwunden sind.
keywords: Omnivore Alternative, Omnivore Export, Omnivore ZIP importieren, Omnivore eingestellt, Omnivore Ersatz
---

Der gehostete Dienst von Omnivore wurde im November 2024 eingestellt. Das Team wechselte zu einer anderen Firma, und die Nutzer hatten etwa zwei Wochen, um ihre Daten herauszuholen.

Wenn du rechtzeitig exportiert hast, hast du ein ZIP. Behalt es. Das meiste, was du in Omnivore aufgehoben hast, steckt darin als die Seite selbst, nicht nur als Link darauf.

![Ein Omnivore-ZIP, ausgepackt zu ganzen Seiten, eine davon im Pluck-Reader geöffnet.](/blog/omnivore-is-gone/hero.png)

## Was im ZIP steckt

Ein Omnivore-Export ist ein Ordner mit Metadaten-Dateien und, für das meiste, was du aufgehoben hast, der Seite als HTML.

Das zählt jetzt. Manche dieser Websites sind umgezogen, haben sich verändert oder sind weg, und dein ZIP hat noch, was dort stand.

## Rüberholen

1. [Meld dich bei Pluck an](/signin). Du bekommst einen Link per E-Mail. Ein Passwort gibt es nicht.
2. Öffne Einstellungen, dann Import und Export.
3. Wähl Omnivore (ZIP) und zieh die Datei hinein.

Der Import läuft im Hintergrund, du kannst den Tab also schließen.

## Was mitkommt

- Jeder Link, mit seinem Titel.
- Deine Labels, als Tags.
- Das Datum, an dem du jeden aufgehoben hast.
- Der Seitentext, direkt aus dem ZIP gelesen. Pluck geht dafür nicht zurück zur Website, also kommt eine Seite, deren Website weg ist, trotzdem vollständig an.

Für alles ohne Seite im ZIP holt Pluck die Seite neu, ein paar auf einmal.

## Wo es landet

Im Archiv, als Importiert markiert, und alles auffindbar, Seitentext inklusive. Dein Eingang bleibt leer, bis du etwas Neues pflückst.

## Open Source hat nicht gereicht

Omnivore war Open Source und ist trotzdem verschwunden. Der Code blieb öffentlich. Der Dienst nicht, und ihn selbst zu betreiben war ein Projekt für sich.

Öffentlicher Code ist also nur die eine Hälfte. Hier ist die andere:

- **Dein eigenes Pluck braucht einen Befehl.** Es ist `docker compose up -d` aus dem [Repository](/open-source). Die Web-App, die iPhone-App und deine KI arbeiten alle mit deinem Server, und die Chrome-Erweiterung baust du mit einem weiteren Befehl dafür.
- **Export funktioniert heute.** Jeder Eintrag kommt als JSON heraus, mit deinen Notizen und Markierungen, dazu eine Markdown-Datei für jeden Eintrag und jede Liste.
- **Pluck behält die Seite, nicht nur den Link.** Sie wird behalten, wenn du sie pflückst, also nimmt die nächste Schließung weniger mit.

## Nicht nur Omnivore

Derselbe Bildschirm nimmt eine Pocket-CSV, eine Raindrop-CSV und die Lesezeichendatei, die dein Browser exportiert. Bring alle mit. Was in zwei Dateien steckt, wird ein Eintrag.

Dann pflück das Nächste vom Handy, aus Chrome, per E-Mail oder über [deine KI](/connect).

Noch da, wenn die Website es nicht mehr ist.
