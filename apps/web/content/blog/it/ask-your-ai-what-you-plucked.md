---
title: Chiedi alla tua IA cosa hai preso.
description: Un link porta tutta la tua libreria in Claude, ChatGPT, Cursor o qualsiasi strumento di IA che parli MCP. Trenta secondi, e non elimina mai nulla.
keywords: MCP read it later, server MCP per articoli, collegare Claude a una lista di lettura, ChatGPT lista di lettura, connettore personalizzato Claude
---

A marzo hai preso una ricetta per i risoni con i pomodorini arrosto, quella da 30 minuti. Sai di averla presa, ma non la trovi.

La tua IA sì. Dalle un link e legge tutta la tua libreria di Pluck: i titoli, le tue note, i tuoi tag, le tue liste e il testo di ogni pagina che Pluck ha conservato.

![Una domanda a uno strumento di IA, con la risposta presa da una libreria di Pluck.](/blog/ask-your-ai-what-you-plucked/hero.png)

## Qui dentro non c'è IA

Pluck non manda mai di sua iniziativa quello che prendi a un modello. Niente tag messi alle tue spalle, nessun riassunto che spunta dal nulla.

La tua IA entra quando la colleghi e fa quello che le chiedi. Si collega tramite MCP, lo standard aperto che gli strumenti di IA usano per collegarsi alle app. Pluck lo parla, quindi può collegarsi qualsiasi strumento che lo parli: Claude, ChatGPT, Cursor e gli altri.

## Collegala

Il link è lo stesso per ogni strumento:

```
https://getpluck.io/mcp
```

- **Claude.** Impostazioni, poi Connettori. Scegli Aggiungi connettore personalizzato e incolla il link. Una volta aggiunto, funziona sul web, sul desktop e sul telefono.
- **ChatGPT.** Impostazioni, poi Connettori. Scegli Crea e incolla il link come URL del server MCP. Serve un piano che consenta i connettori personalizzati.
- **Claude Code.** Una riga nel terminale, qui sotto.
- **Cursor.** Impostazioni, poi MCP. Aggiungi un server con il link.

```
claude mcp add --transport http pluck https://getpluck.io/mcp
```

La prima volta, ognuno ti chiede di accedere a Pluck, e basta. In [Collega la tua IA](/connect) trovi gli stessi passaggi, con un pulsante per copiare.

## Poi chiedi

- "Cosa ho preso su Lisbona?"
- "Metti in ordine la mia Inbox di Pluck." Propone tag tra quelli che hai già, e per ogni elemento tieni, più tardi o archivia. Tu dici sì o li cambi, tutto in un colpo.
- "Fammi una lista di lettura sul lievito madre, partendo dalle migliori." Cerca, legge e costruisce una lista in ordine, con una riga sul perché ciascuno è lì. La lista resta privata finché non dici altrimenti.
- "Tre idee per il blog da quello che ho preso questa settimana." Legge per intero le cinque cose migliori e abbozza tre angolazioni, con le fonti.
- "Fai la mia revisione settimanale." L'email del lunedì in forma di conversazione, una decisione alla volta.
- "Prendi questo come nota: chiedere ad Aoife dei montatori." Finisce nella tua Inbox come Nota.

## Cosa non può fare

- Eliminare qualcosa. Pluck non gliene dà il permesso.
- Rendere pubblica una lista. Solo tu puoi farlo, dalla lista in Pluck.
- Creare un tag che non hai chiesto, o rinominarne uno creato da te.
- Cambiare lo scopo di una lista.

Ogni tag e ogni lista che crea porta il segno "dall'IA". Se una settimana dei suoi tag non ti convince, in Impostazioni li togli tutti con un tocco.

![Una lista di Pluck creata da uno strumento di IA, con il segno dall'IA color argilla.](/blog/ask-your-ai-what-you-plucked/marked.png)

## Scollegala

Impostazioni, poi Strumenti di IA, poi Scollega. Si ferma subito, non alla fine di una sessione.

## Se Pluck lo ospiti tu

Self-hosting senza un indirizzo pubblico? Crea una chiave API in Impostazioni e fai da ponte in locale:

```
npx @getpluck/mcp --server https://pluck.your.host --key pk_live_…
```

Hai gli stessi strumenti e gli stessi prompt, puntati sul tuo server.

Qui dentro non c'è IA. Porta la tua.
