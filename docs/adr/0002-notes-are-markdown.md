# Notes are stored as Markdown, and rich editing is a view over it

Notes are getting basic formatting (bold, italic, two heading sizes, bullet and numbered lists, links), edited the way Apple Notes is, with no marks showing. A Note's text stays one string, and that string is Markdown. The connector already hands every Item to an AI tool as Markdown, the iPhone reader already draws it, `$text` search reads it with no tags to strip, and every plain Note written so far is already valid. The editor converts at its edge.

## Considered options

- **A rich-text document (HTML or an editor's JSON).** What most editors store. It needs a converter for the connector in both directions, a sanitiser wherever a Note is shown, and a migration for the Notes that exist.
- **Markdown typed by hand, formatted only when reading.** No editor to add. Refused because most people do not know Markdown.

## Consequences

- The formatting set is what both editors keep: bold, italic, headings, bullets and numbers, and links. Underline is out, because Markdown has no form for it. Quotes, checklists, tables and code blocks are out of editing, because the editor (`react-native-enriched-markdown`, native on the iPhone, its DOM build on the web) cannot edit them.
- One line is one block, and a blank line is a blank line, as a plain Note was always kept: the editor reads `first\nsecond` as two lines, not as one paragraph the way strict Markdown would. A plain Note opens looking as it did.
- The two editors spell the same Note differently (the web escapes a typed `*` or `_` and nests a list by two spaces, the iPhone by three with no escapes) and each reads the other's. `sameNote` in shared-schemas says when two spellings are one Note.
- An editor opens a Note only when it reads the text back the same by that measure. One it would change, such as a table or a quote an AI tool wrote, opens in the plain text editor instead. The rich editor never rewrites a Note it cannot read back unchanged.
- Formatting belongs to the text of a Note, Todo or Thing. The notes on a link Item, a List entry and a Highlight stay plain.
- Titles, row excerpts and the row's second line are made from the text, so they drop the marks (`plainLine`). Search reads the text as it is kept.
