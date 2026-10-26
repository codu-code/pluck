---
title: Le app per leggere più tardi continuano a chiudere.
description: Pocket se n'è andato. Omnivore se n'è andato. Cinque cose da controllare prima di affidare la tua libreria alla prossima.
keywords: read it later open source, read it later self-hosted, alternativa a Pocket, Wallabag, Karakeep, Linkwarden
---

Omnivore se n'è andato a novembre 2024, con circa due settimane di preavviso. Pocket a luglio 2025, con qualche mese per esportare. Tutti e due contenevano anni di cose che la gente voleva leggere.

Nessuno dei due ha chiuso per colpa dei suoi utenti. Un'azienda ha deciso, ed è partito il conto alla rovescia.

Quindi, prima di fidarti della prossima, controlla cinque cose. Pluck è l'app che facciamo noi, e la mettiamo alla prova con la stessa lista.

![Una libreria che lascia un'app sotto forma di file che puoi aprire: JSON, Markdown, un CSV e uno zip.](/blog/read-it-later-apps-keep-closing/hero.png)

## 1. Puoi portare via tutto, oggi?

Non "l'export arriva presto". Non un'email all'assistenza. Un pulsante, oggi, e un file che puoi aprire senza l'app.

Quello di Pluck sta in Impostazioni, e il link allo zip ti arriva via email in un minuto o due. Dentro c'è ogni elemento in JSON, con le tue note e le tue evidenziazioni, più un file Markdown per ogni elemento e ogni lista. Ogni singola lista si scarica in Markdown anche dalla sua pagina.

## 2. Conserva la pagina, o solo il link?

Un link funziona solo finché qualcun altro tiene su la pagina. I siti si spostano, finiscono dietro un paywall o spariscono.

Pluck conserva il testo della pagina quando la prendi, così la tua copia c'è ancora quando il sito non c'è più. Quando una pagina non si può leggere, Pluck lo dice e offre la copia su Wayback.

## 3. Il codice è pubblico?

Se il codice è pubblico, l'app può sopravvivere all'azienda. Qualcuno può farne un fork, e tu puoi leggere cosa fa con i tuoi dati.

Pluck è open source: AGPL-3.0 per il server, MIT per le app.

Il codice pubblico, intendiamoci, non è tutta la risposta. Anche Omnivore era open source.

## 4. Puoi farlo girare da te senza perderci un weekend?

È questo che ti salva quando l'azienda se ne va, quindi far girare la tua copia deve essere una cosa normale.

Per Pluck è `git clone`, poi `docker compose up -d`. L'app web, l'app per iPhone e la tua IA funzionano tutte con il tuo server, e l'estensione per Chrome si compila per il tuo server con un comando in più. La [guida al self-hosting](https://github.com/codu-code/pluck/blob/main/docs/self-host.md) copre email, storage ed estensione.

## 5. La tua IA entra alle tue condizioni?

Prima o poi vorrai che la tua IA cerchi nella tua libreria e la metta in ordine. La domanda è chi comanda.

Pluck non ha IA dentro. Il tuo strumento di IA si collega con un link tramite MCP, lo standard aperto, e fa quello che chiedi. Non può eliminare niente né rendere pubblica una lista, e ogni tag e lista che crea porta un segno. In [Collega la tua IA](/connect) trovi i dettagli.

## Le altre

Vale la pena guardarsi intorno. Alcune buone:

- **Wallabag** è open source ed esiste da molto tempo. È fatta per girare sul tuo server, e c'è un hosting a pagamento se preferisci evitarlo.
- **Karakeep** (prima si chiamava Hoarder) è open source e self-hosted, con i tag dall'IA integrati se configuri un modello.
- **Linkwarden** è open source e conserva copie delle pagine che gli dai.
- **Raindrop**, **Readwise Reader** e **Instapaper** sono curate nei dettagli e closed source. Mentre scriviamo, il connettore IA di Raindrop è una beta nel piano a pagamento.

Dove si colloca Pluck: si usa gratis su getpluck.io, lo stesso codice gira sul tuo server, e ogni account ha un connettore per l'IA. È un'unica Inbox per articoli, video, note, cose da fare e il piano cottura che stai pensando di comprare.

## Se stai traslocando

Pluck importa un CSV di Pocket, uno zip di Omnivore, un CSV di Raindrop e il file dei segnalibri che esporta il tuo browser. Tutto finisce nell'Archivio, cercabile, così la tua Inbox parte vuota. Se hai tenuto un export di Pocket, [ecco la guida](/blog/pocket-is-gone). Per Omnivore, [questa](/blog/omnivore-is-gone).

Prendilo. Sistemalo dopo.
