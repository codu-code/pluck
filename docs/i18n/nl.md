# Pluck in Dutch (nl)

How Pluck's product words are said in Dutch, and why. Use these and no others in `packages/i18n/messages/*/nl.json` and `docs/store/nl.json`.

## Product words

| English | Dutch | Why | Seen in |
|---|---|---|---|
| Pluck (brand) | Pluck | The brand stays in Latin letters, never translated, never inflected. | |
| pluck (verb) | plukken: pluk, plukt, plukte, geplukt | Dutch has the same word with the same meaning (to pick fruit or flowers), so the pun survives with no explanation and conjugates naturally: "Pluk het", "Wat heb ik geplukt?". The brand stays "Pluck"; the verb is Dutch. | Pocket NL used a branded verb phrase ("Opslaan in Pocket"); a native verb reads warmer. |
| Pluck it (button) | Pluk het | Short imperative, mirrors the English. | |
| Plucked (confirmation) | Geplukt. | Past participle, one word, like "Opgeslagen" in Apple and Google apps but on brand. | |
| plucks (noun) | wat je plukt / items | "Plukken" as a plural noun is awkward. Rephrase with the verb, or use "items" for counts ("# items wachten"). | |
| Item | item, items | Standard Dutch software word (de/het item; we use "het item"). Capitalised "Item" only where English capitalises it in store copy. | Todoist NL, Microsoft NL |
| Kind | Soort | Plain everyday word. "Type" felt technical. | Apple NL ("soort") |
| Read | Lezen | Kinds are activities in English (Read, Watch); Dutch infinitives do the same. | Safari "Leeslijst" |
| Watch | Kijken | As above. | |
| PDF | PDF | Kept in capitals as a Kind label; plural "PDF’s". | |
| Image | Afbeelding | Standard UI word for image. | Chrome NL, Apple NL |
| Note | Notitie | Apple's Notes app is "Notities". | Apple Notities |
| Todo | Taak (Taken) | "To-do" exists in Dutch but "taak" is what task apps use. | Todoist NL, Microsoft To Do NL, Apple Herinneringen |
| Thing | Ding (Dingen) | Plain and warm, like the English. "Een Ding is iets om te halen." | |
| Status | Status | Same word in Dutch. | |
| Inbox | Inbox | Dutch Gmail, Todoist and Notion all say "Inbox"; "Postvak IN" now reads dated. | Gmail NL, Todoist NL, Notion NL |
| Later | Later | Same word, same meaning. | |
| Archived (status) | Gearchiveerd | | Gmail NL ("archiveren") |
| Archive (place) | het Archief | Expiry copy always says "naar het Archief" and "er wordt niets verwijderd". | Pocket NL ("Archief") |
| Archive (verb, button) | Archiveren (web) / Archiveer (iPhone) | See button style below. | Gmail NL |
| Done | Klaar | Short, warm and works as a status, a toast ("Klaar.") and a button. Apple Herinneringen and Todoist say "Voltooid", which is formal for Pluck; Apple's Done button is "Gereed", which is stiff. | Apple Herinneringen, Todoist NL |
| Tag | tag, tags, taggen | Dutch software says "tag". | Pocket NL, Apple Herinneringen ("tags") |
| List | lijst, Lijst | Capitalised "Lijst" exactly where English capitalises "List". Never "collectie". | Apple Herinneringen ("Lijsten") |
| Bin | Prullenbak | What every Dutch app calls it. | Apple, Google, Windows NL |
| highlight | markering, markeren | | Apple Boeken, Kindle NL |
| your AI | je AI | Informal like the rest; "hij" as the pronoun ("Hij verandert alleen iets als jij dat zegt"). | |
| AI tools | AI-tools | Dutch compound with hyphen (AI-tool, AI-model). | |
| connector | connector | Dutch tech writing keeps the English word, and it matches what people see in their AI tool's settings. The Connect page gives the AI tools' menu names in Dutch ("Aangepaste connector toevoegen"); check them against each tool's Dutch UI when it changes. | |
| Expiry | Verlopen (settings section "Verlopen en archief") | "Verloopt", "verlopen" for Items that move to the Archive. | |
| Email-in | E-mail naar Pluck | "Email-in" has no Dutch equivalent; describe it. In an Item's site line: "via e-mail". | |
| Due | Deadline | "Deadline vandaag", "deadline morgen", "te laat". "Vervalt" would clash with expiry. | Todoist NL ("deadline") |
| Settings | Instellingen | | Every Dutch app |
| Keep (an Item from expiry) | bewaren: Bewaren, Bewaard, "Bewaar het" | "Gehouden" is not something a Dutch app says. Keep the AI's tag and keep a handle stay "houden" ("Houden", "@{handle} houden"). In the weekly email the pair is Bewaren / Loslaten. | Pocket NL ("bewaren") |
| handle | gebruikersnaam | What Instagram, X and Threads NL call it; "handle" is jargon. The URL keeps the @. | Instagram NL, X NL |
| Disconnect | loskoppelen: "Loskoppelen" (web), "Koppel los" (iPhone) | Matches "is losgekoppeld". "Verbreken" needs an object ("de verbinding verbreken") and reads cut off as a button. | Apple NL |
| talk (a talk you give) | presentatie | "Talk" is meetup jargon; everyone says presentatie. | |
| run my weekly review (MCP prompt) | “start mijn weekreview” | "Doe mijn weekoverzicht" mixes up an overview with a review. Weekreview is the GTD word Dutch productivity writers use. | |
| Lists are what you're making | Lijsten voor wat je maakt / Waar je aan werkt | "Lijsten zijn wat je maakt" is an English sentence in Dutch words. | |
| sign in / sign out | inloggen / uitloggen | | |
| share sheet | deelmenu; the button is "Deel" | Apple NL names the button "Deel". | Apple NL, iCulture |
| weekly email / Monday email | weekmail / maandagmail | One word, like Dutch "nieuwsbrief". | |
| Archive it all. No, really. | Alles archiveren. Echt waar. | Keeps the wink; the screen around it says "naar het Archief" and "er wordt niets verwijderd". | |
| Pluck it, I'm in / Pluck off | Pluk maar, ik doe mee / Niks plukken | "Pluck off" is a pun on a rude phrase. Dutch has none that fits, so "Niks plukken" ("pluck nothing") keeps the brand verb and reads clearly as the No button. The Privacy page quotes both labels. | |

## Words we avoid

- **opslaan / opgeslagen** (saved) and **bladwijzer** (bookmark): we say **bewaren / bewaard** (keep, kept) and **plukken**. "Opslaan" appears only where the English itself says Save (the Save button on the web, the note's "Opgeslagen" state) and "bladwijzers" only for the browser's own bookmarks file in Import, which is what the browser calls it.
- **collectie** (collection): always **lijst**.
- **slim** (smart), **AI-gestuurd** (AI-powered), **magisch** (magic): never.
- One AI vendor on its own: always "je AI" or a list ("Claude, ChatGPT of Cursor").

## Tone

- **Informal "je"**, never "u". Dutch apps for individuals (Todoist, Apple, Notion, Gmail) all say "je". Use "jij/jouw" only for emphasis ("Jouw AI, jouw keuze", "alleen jij").
- Short, plain and warm, like the English. Prefer the Dutch word order of speech over a word-for-word copy ("Zie je Pluck niet, scrol dan…").
- No exclamation marks, no emoji.
- Expiry copy: the Item "gaat naar het Archief" and "er wordt niets verwijderd".

## Style

- **Capitalisation:** sentence case for titles and buttons, as Dutch does. Product words are capitalised where the English capitalises them (Inbox, Later, Archief, the Kind names, Lijst when English says List). Lowercase in running text otherwise.
- **Buttons:** on the web and in the extension, the infinitive ("Annuleren", "Kopiëren", "Archiveren"), as Google and Microsoft do. On the iPhone, the imperative ("Annuleer", "Bewaar", "Kopieer", "Deel"), as Apple's own Dutch apps do. Longer calls to action on the web may be a sentence in the imperative ("Open de Inbox", "Stuur een nieuwe link").
- **Busy states** never repeat their button: "Bezig met inloggen" next to "Inloggen", "Wordt opgeslagen" next to "Opslaan", "Wordt geplukt" for Plucking.
- **Offline sync:** what waits on the device "wordt verstuurd" when you are back, never "gaat mee".
- **Quotes:** curly double quotes “…”, as in the English source. Apostrophes are the typographic ’ ("pagina’s", "zo’n"); a straight ' is an ICU escape character, so never put one before { or #.
- **Numbers and time:** "10 minuten", "06:00", "{n} min", "{n} uur geleden".
- **Plurals:** Dutch has one and other. Always include other; # is the number.
- **Compounds:** hyphenate with abbreviations and brand names: AI-tool, API-sleutel, MCP-server, Pluck-bibliotheek, Markdown-bestand.
