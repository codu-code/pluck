---
title: Vraag je AI wat je hebt geplukt.
description: Eén link zet je hele bibliotheek in Claude, ChatGPT, Cursor of elke AI-tool die MCP spreekt. Dertig seconden, en hij verwijdert nooit iets.
keywords: read later MCP, MCP-server voor artikelen, Claude koppelen aan leeslijst, ChatGPT leeslijst, Claude connector
---

In maart plukte je een recept voor orzo met langzaam geroosterde tomaten, dat van 30 minuten. Je weet dat je het deed, maar je vindt het niet meer.

Je AI wel. Geef hem één link en hij leest je hele Pluck-bibliotheek: de titels, je notities, je tags, je lijsten en de tekst van elke pagina die Pluck bewaarde.

![Een vraag aan een AI-tool, beantwoord vanuit een Pluck-bibliotheek.](/blog/ask-your-ai-what-you-plucked/hero.png)

## Er zit hier geen AI in

Pluck stuurt wat je plukt nooit uit zichzelf naar een model. Niets wordt achter je rug getagd, en er verschijnen geen samenvattingen.

Je AI komt erbij als jij hem verbindt, en doet wat je vraagt. Hij verbindt via MCP, de open standaard waarmee AI-tools op apps aansluiten. Pluck spreekt die, dus elke tool die dat ook doet, kan verbinden: Claude, ChatGPT, Cursor en de rest.

## Verbind hem

De link is voor elke tool dezelfde:

```
https://getpluck.io/mcp
```

- **Claude.** Instellingen, dan Connectors. Kies Aangepaste connector toevoegen en plak de link. Eenmaal toegevoegd werkt het op web, desktop en telefoon.
- **ChatGPT.** Instellingen, dan Connectors. Kies Maken en plak de link als URL van de MCP-server. Je hebt een abonnement nodig waarin aangepaste connectors zijn toegestaan.
- **Claude Code.** Eén regel in een terminal, hieronder.
- **Cursor.** Instellingen, dan MCP. Voeg een server toe met de link.

```
claude mcp add --transport http pluck https://getpluck.io/mcp
```

De eerste keer vraagt elke tool je om in te loggen bij Pluck, en dat is alles. [Verbind je AI](/connect) heeft dezelfde stappen, met een kopieerknop.

## Vraag dan

- “Wat heb ik geplukt over Lissabon?”
- “Ruim mijn Pluck-inbox op.” Hij stelt tags voor uit de tags die je al hebt, en per item bewaren, later of archiveren. Jij zegt ja of past aan, alles in één keer.
- “Maak een leeslijst over zuurdesem, beste eerst.” Hij zoekt, leest en bouwt een lijst op volgorde, met een regel over waarom elk item erin staat. De lijst blijft privé tot jij iets anders zegt.
- “Drie blogideeën uit wat ik deze week plukte.” Hij leest de beste vijf helemaal en schetst drie invalshoeken, met bronnen.
- “Start mijn weekreview.” De maandagmail als gesprek, één beslissing tegelijk.
- “Pluk dit als notitie: vraag Aoife naar de monteurs.” Het komt in je Inbox als Notitie.

## Wat hij niet kan

- Iets verwijderen. Pluck geeft hem daar geen toestemming voor.
- Een lijst openbaar maken. Dat kun alleen jij, vanuit de lijst in Pluck.
- Een tag maken waar je niet om vroeg, of een tag hernoemen die jij maakte.
- Veranderen waar een lijst voor is.

Elke tag en lijst die hij maakt, krijgt een “door AI”-markering. Ben je niet blij met een week van zijn taggen, dan haal je die tags in Instellingen met één tik weg.

![Een Pluck-lijst gemaakt door een AI-tool, met de markering door AI in kleikleur.](/blog/ask-your-ai-what-you-plucked/marked.png)

## Koppel hem los

Instellingen, dan AI-tools, dan Loskoppelen. Hij stopt meteen, niet pas aan het eind van een sessie.

## Je eigen Pluck draaien

Zelf gehost zonder openbaar adres? Maak een API-sleutel in Instellingen en verbind die lokaal:

```
npx @getpluck/mcp --server https://pluck.your.host --key pk_live_…
```

Je krijgt dezelfde tools en dezelfde prompts, gericht op je eigen server.

Er zit hier geen AI in. Neem je eigen mee.
