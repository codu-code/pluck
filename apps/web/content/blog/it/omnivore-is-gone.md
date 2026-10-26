---
title: Omnivore non c'è più. Le pagine nel tuo zip sì.
description: Se hai tenuto l'export di Omnivore, Pluck legge le pagine direttamente dallo zip. Anche quelle i cui siti non esistono più.
keywords: alternativa a Omnivore, export Omnivore, importare zip Omnivore, Omnivore chiude
---

Il servizio di Omnivore ha chiuso a novembre 2024. Il team è passato a un'altra azienda, e gli utenti hanno avuto circa due settimane per portare via i propri dati.

Se hai esportato in tempo, hai uno zip. Tienilo. Quasi tutto quello che tenevi su Omnivore è lì dentro come pagina vera e propria, non solo come link.

![Uno zip di Omnivore aperto in pagine intere, una delle quali aperta nel lettore di Pluck.](/blog/omnivore-is-gone/hero.png)

## Cosa c'è nello zip

Un export di Omnivore è una cartella di file di metadati e, per la maggior parte delle cose che hai tenuto, la pagina in HTML.

Adesso questo conta. Alcuni di quei siti si sono spostati, sono cambiati o sono spariti, e il tuo zip ha ancora quello che dicevano.

## Portalo in Pluck

1. [Accedi a Pluck](/signin). Ti arriva un link via email. Niente password.
2. Apri Impostazioni, poi Importa ed esporta.
3. Scegli Omnivore (zip) e trascina dentro il file.

L'importazione gira in background, quindi puoi chiudere la scheda.

## Cosa arriva

- Ogni link, con il suo titolo.
- Le tue etichette, come tag.
- La data in cui hai tenuto ciascuno.
- Il testo della pagina, letto direttamente dallo zip. Per queste Pluck non torna sul sito, quindi una pagina il cui sito non c'è più arriva comunque intera.

Per tutto ciò che non ha una pagina nello zip, Pluck scarica di nuovo la pagina, poche alla volta.

## Dove finisce

Nell'Archivio, con il segno Importato, e tutto cercabile, testo delle pagine compreso. La tua Inbox resta vuota finché non prendi qualcosa di nuovo.

## Essere open source non bastava

Omnivore era open source, e se n'è andato lo stesso. Il codice è rimasto pubblico. Il servizio no, e farlo girare da sé era un progetto a parte.

Quindi il codice pubblico è solo metà della storia. Ecco l'altra metà:

- **Per farlo girare da te basta un comando.** È `docker compose up -d` dal [repository](/open-source). L'app web, l'app per iPhone e la tua IA funzionano tutte con il tuo server, e l'estensione per Chrome si compila per il tuo server con un comando in più.
- **L'export funziona già oggi.** Ogni elemento esce in JSON, con le tue note e le tue evidenziazioni, più un file Markdown per ogni elemento e ogni lista.
- **Pluck conserva la pagina, non solo il link.** La conserva quando la prendi, così la prossima chiusura si porta via meno roba.

## Non solo Omnivore

La stessa schermata accetta un CSV di Pocket, un CSV di Raindrop e il file dei segnalibri che esporta il tuo browser. Portali tutti. Quello che sta in due file diventa un solo elemento.

Poi prendi la prossima cosa dal telefono, da Chrome, dall'email o dalla [tua IA](/connect).

Resta qui anche quando il sito non c'è più.
