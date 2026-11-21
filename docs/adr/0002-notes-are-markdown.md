# Notes are stored as Markdown, and rich editing is a view over it

Notes are getting basic formatting (bold, italic, two heading sizes, bullet and numbered lists, links), edited the way Apple Notes is, with no marks showing. A Note's text stays one string, and that string is Markdown. The connector already hands every Item to an AI tool as Markdown, the iPhone reader already draws it, `$text` search reads it with no tags to strip, and every plain Note written so far is already valid. The editor converts at its edge. Decided, not built yet.

## Considered options

- **A rich-text document (HTML or an editor's JSON).** What most editors store. It needs a converter for the connector in both directions, a sanitiser wherever a Note is shown, and a migration for the Notes that exist.
- **Markdown typed by hand, formatted only when reading.** No editor to add. Refused because most people do not know Markdown.

## Consequences

- The formatting set is what the editor can save as Markdown and read back unchanged. Underline is out, because Markdown has no form for it. Quotes, checklists, tables and code blocks are out of editing, because the iPhone editor (`react-native-enriched-markdown`) cannot edit them.
- A Note holding something the rich editor cannot keep exactly, such as a table an AI tool wrote, opens in the plain text editor instead. The rich editor never rewrites a Note it cannot read back unchanged.
- A plain Note with single line breaks has to look the same afterwards, so a line break stays a break and is not joined to the next line as Markdown would.
- Formatting belongs to the text of a Note, Todo or Thing. The notes on a link Item, a List entry and a Highlight stay plain.
- Titles, row excerpts and search snippets are made from the text, so they drop the marks.
- Web shows Notes formatted first. Its editor is chosen after trying the iPhone's library there, with TipTap as the fallback; whichever it is writes the same Markdown.
