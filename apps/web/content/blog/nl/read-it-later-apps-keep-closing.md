---
title: Read-later-apps verdwijnen keer op keer.
description: Pocket ging. Omnivore ging. Vijf dingen om te checken voordat je de volgende je bibliotheek toevertrouwt.
keywords: open source read later app, read later zelf hosten, Pocket alternatief, Wallabag, Karakeep, Linkwarden
---

Omnivore ging in november 2024, met ongeveer twee weken vooraankondiging. Pocket ging in juli 2025, met een paar maanden om te exporteren. Allebei bevatten ze jaren aan dingen die mensen nog wilden lezen.

Geen van beide stopte omdat de gebruikers iets fout deden. Een bedrijf besliste, en de klok begon te lopen.

Check dus vijf dingen voordat je de volgende vertrouwt. Pluck is de app die wij maken, en we houden hem aan dezelfde lijst.

![Een bibliotheek die een app verlaat als bestanden die je kunt openen: JSON, Markdown, een CSV en een zip.](/blog/read-it-later-apps-keep-closing/hero.png)

## 1. Kun je vandaag alles eruit halen?

Niet “export komt eraan”. Geen mail naar support. Een knop, vandaag, en een bestand dat je zonder de app kunt openen.

Die van Pluck zit in Instellingen, en een link naar de zip komt binnen een minuut of twee per e-mail. Daarin zit elk item als JSON, met je notities en markeringen, plus een Markdown-bestand voor elk item en elke lijst. Elke losse lijst kun je ook als Markdown downloaden vanaf zijn eigen pagina.

## 2. Bewaart hij de pagina, of alleen de link?

Een link werkt alleen zolang iemand anders de pagina online houdt. Sites verhuizen, gaan achter een betaalmuur of verdwijnen.

Pluck bewaart de paginatekst als je hem plukt, dus je kopie is er nog als de site er niet meer is. Kan een pagina niet gelezen worden, dan zegt Pluck dat en biedt het de Wayback-kopie aan.

## 3. Is de code openbaar?

Is de code openbaar, dan kan de app het bedrijf overleven. Iemand kan hem forken, en jij kunt lezen wat hij met je data doet.

Pluck is open source onder Apache-2.0, de server en de apps allebei.

Openbare code is niet het hele antwoord, hoor. Omnivore was ook open source.

## 4. Kun je hem zelf draaien zonder er een weekend aan kwijt te zijn?

Dit redt je als het bedrijf verdwijnt, dus je eigen versie draaien moet heel gewoon zijn.

Voor Pluck is het `git clone`, dan `docker compose up -d`. De web-app, de iPhone-app en je AI werken allemaal met je server, en de Chrome-extensie bouw je ervoor met nog één commando. De [handleiding voor zelf hosten](https://github.com/codu-code/pluck/blob/main/docs/self-host.md) behandelt mail, opslag en de extensie.

## 5. Komt je AI binnen op jouw voorwaarden?

Vroeg of laat wil je dat je AI je bibliotheek doorzoekt en sorteert. De vraag is wie de baas is.

Pluck heeft geen AI ingebouwd. Je eigen AI-tool verbindt met één link via MCP, de open standaard, en doet wat je vraagt. Hij kan niets verwijderen en geen lijst openbaar maken, en elke tag en lijst die hij maakt, is gemarkeerd. [Verbind je AI](/connect) heeft de details.

## De anderen

Kijk gerust rond. Een paar goede:

- **Wallabag** is open source en bestaat al lang. Het is gemaakt om op je eigen server te draaien, en er is betaalde hosting als je dat liever niet doet.
- **Karakeep** (vroeger Hoarder) is open source en zelf gehost, met AI-tagging ingebouwd als je een model instelt.
- **Linkwarden** is open source en bewaart kopieën van de pagina’s die je het geeft.
- **Raindrop**, **Readwise Reader** en **Instapaper** zijn gepolijst en closed source. Op het moment van schrijven is de AI-connector van Raindrop een bèta in het betaalde abonnement.

Waar Pluck past: gratis te gebruiken op getpluck.io, dezelfde code draait op je eigen server, en elk account heeft een AI-connector. Het is één inbox voor artikelen, video’s, notities, taken en de kookplaat die je misschien gaat kopen.

## Als je overstapt

Pluck importeert een Pocket-CSV, een Omnivore-zip, een Raindrop-CSV en het bladwijzerbestand dat je browser exporteert. Alles komt in het Archief, te vinden, zodat je Inbox leeg begint. Heb je een Pocket-export bewaard, [hier is de uitleg](/blog/pocket-is-gone). Voor Omnivore, [deze](/blog/omnivore-is-gone).

Pluk het. Sorteer het later.
