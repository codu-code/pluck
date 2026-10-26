---
title: Omnivore is weg. De pagina’s in je zip niet.
description: Heb je je Omnivore-export bewaard, dan leest Pluck de pagina’s rechtstreeks uit de zip. Ook die van sites die er niet meer zijn.
keywords: Omnivore alternatief, Omnivore export, Omnivore zip importeren, Omnivore gestopt
---

De gehoste dienst van Omnivore stopte in november 2024. Het team ging naar een ander bedrijf, en gebruikers hadden ongeveer twee weken om hun data eruit te halen.

Heb je op tijd geëxporteerd, dan heb je een zip. Bewaar hem. Het meeste wat je in Omnivore bewaarde, zit daarin als de pagina zelf, niet alleen als een link ernaartoe.

![Een Omnivore-zip uitgevouwen tot hele pagina’s, waarvan er één openstaat in de lezer van Pluck.](/blog/omnivore-is-gone/hero.png)

## Wat er in de zip zit

Een Omnivore-export is een map met metadatabestanden en, voor het meeste wat je bewaarde, de pagina als HTML.

Dat is nu belangrijk. Sommige van die sites zijn verhuisd, veranderd of verdwenen, en je zip heeft nog wat er stond.

## Haal het over

1. [Log in bij Pluck](/signin). Je krijgt een link per e-mail. Er is geen wachtwoord.
2. Open Instellingen, dan Importeren en exporteren.
3. Kies Omnivore (zip) en sleep het bestand erin.

De import loopt op de achtergrond, dus je kunt het tabblad sluiten.

## Wat er meekomt

- Elke link, met de titel.
- Je labels, als tags.
- De datum waarop je elk ervan bewaarde.
- De paginatekst, rechtstreeks uit de zip gelezen. Pluck gaat hiervoor niet terug naar de site, dus een pagina waarvan de site weg is, komt toch heel aan.

Voor alles zonder pagina in de zip haalt Pluck de pagina opnieuw op, een paar tegelijk.

## Waar het terechtkomt

In het Archief, gemarkeerd als Geïmporteerd, en alles is te vinden, paginatekst inbegrepen. Je Inbox blijft leeg tot je iets nieuws plukt.

## Open source was niet genoeg

Omnivore was open source, en het verdween toch. De code bleef openbaar. De dienst niet, en hem zelf draaien was een project.

Openbare code is dus maar de helft. Dit is de andere helft:

- **Je eigen versie draaien kost één commando.** Het is `docker compose up -d` vanuit de [repository](/open-source). De web-app, de iPhone-app en je AI werken allemaal met je server, en de Chrome-extensie bouw je ervoor met nog één commando.
- **Exporteren werkt vandaag.** Elk item komt eruit als JSON, met je notities en markeringen, plus een Markdown-bestand voor elk item en elke lijst.
- **Pluck bewaart de pagina, niet alleen de link.** Dat gebeurt als je hem plukt, dus de volgende sluiting neemt minder mee.

## Niet alleen Omnivore

Hetzelfde scherm neemt ook een Pocket-CSV, een Raindrop-CSV en het bladwijzerbestand dat je browser exporteert. Neem ze allemaal mee. Wat in twee bestanden staat, wordt één item.

Pluk daarna het volgende vanaf je telefoon, Chrome, e-mail of [je AI](/connect).

Nog steeds hier, ook als de site weg is.
