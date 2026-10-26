---
title: Frag deine KI, was du gepflückt hast.
description: Ein Link bringt deine ganze Bibliothek in Claude, ChatGPT, Cursor oder jedes KI-Tool, das MCP spricht. Dreißig Sekunden, und gelöscht wird nie etwas.
keywords: MCP Server Leseliste, Claude Konnektor einrichten, ChatGPT Konnektor, Claude mit Leseliste verbinden, später lesen MCP
---

Im März hast du ein Rezept für Orzo mit langsam gerösteten Tomaten gepflückt, das mit den 30 Minuten. Du weißt genau, dass du es gepflückt hast, aber du findest es nicht.

Deine KI findet es. Gib ihr einen Link, und sie liest deine ganze Pluck-Bibliothek: die Titel, deine Notizen, deine Tags, deine Listen und den Text jeder Seite, die Pluck behalten hat.

![Eine Frage an ein KI-Tool, beantwortet aus einer Pluck-Bibliothek.](/blog/ask-your-ai-what-you-plucked/hero.png)

## Hier drin ist keine KI

Pluck schickt nie von sich aus, was du pflückst, an ein Modell. Nichts wird hinter deinem Rücken getaggt, und es tauchen keine Zusammenfassungen auf.

Deine KI kommt dazu, wenn du sie verbindest, und tut, worum du sie bittest. Sie verbindet sich über MCP, den offenen Standard, mit dem sich KI-Tools an Apps anschließen. Pluck spricht ihn, also kann sich jedes Tool verbinden, das ihn auch spricht: Claude, ChatGPT, Cursor und die anderen.

## Verbinden

Der Link ist für jedes Tool derselbe:

```
https://getpluck.io/mcp
```

- **Claude.** Einstellungen, dann Konnektoren. Wähl „Benutzerdefinierten Konnektor hinzufügen“ und füg den Link ein. Einmal hinzugefügt, funktioniert es im Web, auf dem Desktop und auf dem Handy.
- **ChatGPT.** Einstellungen, dann Konnektoren. Wähl „Erstellen“ und füg den Link als URL des MCP-Servers ein. Du brauchst einen Tarif, der eigene Konnektoren erlaubt.
- **Claude Code.** Eine Zeile im Terminal, siehe unten.
- **Cursor.** Einstellungen, dann MCP. Füg einen Server mit dem Link hinzu.

```
claude mcp add --transport http pluck https://getpluck.io/mcp
```

Beim ersten Mal bittet dich jedes Tool, dich bei Pluck anzumelden, und das war’s. [Verbinde deine KI](/connect) hat dieselben Schritte mit einem Kopieren-Button.

## Dann frag

- „Was habe ich über Lissabon gepflückt?“
- „Räum meinen Pluck-Eingang auf.“ Sie schlägt Tags aus denen vor, die du schon hast, dazu pro Eintrag Behalten, Später oder Archiv. Du sagst Ja oder änderst etwas, alles in einem Durchgang.
- „Mach eine Leseliste zu Sauerteig, das Beste zuerst.“ Sie sucht, liest und baut eine Liste in Reihenfolge, mit einer Zeile, warum jeder Eintrag dabei ist. Die Liste bleibt privat, bis du etwas anderes sagst.
- „Drei Blog-Ideen aus dem, was ich diese Woche gepflückt habe.“ Sie liest die besten fünf vollständig und entwirft drei Ansätze, mit Quellen.
- „Mach meinen Wochenrückblick.“ Die Montagsmail als Gespräch, eine Entscheidung nach der anderen.
- „Pflück das als Notiz: Aoife wegen der Monteure fragen.“ Das landet als Notiz in deinem Eingang.

## Was sie nicht kann

- Etwas löschen. Pluck gibt ihr dazu keine Berechtigung.
- Eine Liste öffentlich machen. Das kannst nur du, an der Liste in Pluck.
- Einen Tag anlegen, um den du nicht gebeten hast, oder einen umbenennen, den du angelegt hast.
- Den Zweck einer Liste ändern.

Jeder Tag und jede Liste, die sie anlegt, ist als „von KI“ gekennzeichnet. Wenn dir eine Woche ihres Taggens nicht gefällt, nimmst du diese Tags in den Einstellungen mit einem Fingertipp zurück.

![Eine Pluck-Liste, angelegt von einem KI-Tool, mit dem Hinweis „von KI“ in Tonrot.](/blog/ask-your-ai-what-you-plucked/marked.png)

## Trennen

Einstellungen, dann KI-Tools, dann Trennen. Sie hört sofort auf, nicht erst am Ende einer Sitzung.

## Dein eigenes Pluck

Selbst gehostet, ohne öffentliche Adresse? Leg in den Einstellungen einen API-Schlüssel an und verbinde ihn lokal:

```
npx @pluck/mcp --server https://pluck.your.host --key pk_live_…
```

Du bekommst dieselben Tools und dieselben Prompts, nur mit deinem Server verbunden.

Hier drin ist keine KI. Bring deine eigene mit.
