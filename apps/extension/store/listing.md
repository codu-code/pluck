# Chrome Web Store listing

What to paste into each field of the developer dashboard. The zip is `pnpm --filter @pluck/extension zip` (`.output/pluckextension-<version>-chrome.zip`); build it without `PLUCK_LOCAL`. Images are in this folder.

## Store listing

**Name:** Pluck

**Summary** (132 characters max, from the manifest): Pluck the page you are on into your Pluck library, with one click.

**Category:** Productivity → Tools

**Language:** English

**Description:**

```
Pluck the page you are on. One click keeps it in your Pluck library, with the text as you see it, so you can read it later, find it again, or ask your AI about it.

Click Pluck, or press Alt+Shift+P (⌥⇧P on a Mac). "Plucked" appears with the title, and the popup lets you add a tag, change the Kind, put it on a List, write a note, or send it straight to Later or the Archive.

Right-click a link, an image or the page to pluck it without opening it. Select a sentence and press Alt+Shift+H to keep it as a highlight. Pluck all your tabs into a new List at once.

Pages behind your logins are kept as your browser rendered them. YouTube videos come with their transcript, so search and your AI tools can read what was said.

The Pluck icon fills in on pages already in your library, so you can see at a glance what you have plucked.

No connection? Plucks wait on your computer and go when you are back online.

Pluck speaks English, Spanish, Brazilian Portuguese, French, German, Japanese, Italian, Dutch, Korean and Simplified Chinese, and follows your browser's language.

Pluck is open source. Use getpluck.io, or build the extension for a server you run yourself. There is no AI inside Pluck: you connect the AI tools you already use, if you want to.

Needs a free Pluck account at https://getpluck.io.
```

**Images:**

| Field | File |
|---|---|
| Store icon (128×128) | `../public/icon/128.png` |
| Screenshots (1280×800) | `1-pluck-this-page.png`, `2-your-inbox.png`, `3-the-reader.png` |
| Small promo tile (440×280) | `promo-small-440x280.png` |
| Marquee promo tile (1400×560) | `promo-marquee-1400x560.png` |

**Official URL:** https://getpluck.io (needs the domain verified in Search Console under the same Google account)

**Homepage URL:** https://getpluck.io

**Support URL:** https://getpluck.io/support

## Privacy practices

**Single purpose:**

```
Pluck saves the web page, link, image or text selection you choose into your own Pluck library, so you can read, organise and find it later.
```

**Permission justifications:**

| Permission | Justification |
|---|---|
| `activeTab` | When you click Pluck or press its shortcut, it reads the address, title and text of the tab you are on, so the item is kept as you see it. |
| `scripting` | Runs once in the tab you pluck, after you click, to read the rendered page, your selected text and, on YouTube, the transcript. |
| `tabs` | Reads the address of your open tabs, so the Pluck icon fills in on pages already in your library and "Pluck all tabs" can list them. Only the address is read, never the page. |
| `contextMenus` | Adds "Pluck link", "Pluck image", "Pluck page" and "Pluck selection as highlight" to the right-click menu. |
| `storage` | Keeps your sign-in, your settings and any plucks waiting for a connection on your computer. |
| `unlimitedStorage` | Lets plucks made offline keep the page they captured (up to 4 MB each) until they are sent; without it Chrome stops the extension's storage at 10 MB. |
| `alarms` | Retries plucks that were made offline, once a minute, until they are sent. |
| Host permission `https://getpluck.io/*` | The Pluck server the extension signs in with and sends your plucks to. The only host it can reach when installed. |
| Optional host permissions `https://*/*`, `http://localhost/*`, `http://127.0.0.1/*` | Pluck is open source, and some people run their own Pluck server. These let such a person connect the extension to their server in place of getpluck.io. Nothing is granted at install. Access is requested for one host only, the address the person types in Options under Server, when they click "Use this server"; Chrome asks them, and a no changes nothing. The pattern is wide because that address is theirs and cannot be known in advance; plain `http` is for a server on the same computer only. The access is used for the extension's own requests to that Pluck server (sign-in and plucks) and nothing else: no page on these hosts is read or changed, and nothing is sent anywhere else. It is removed again when the person switches back to getpluck.io or to another server. |

The dashboard has one "Host permission justification" field: paste both rows' text into it, the optional one second.

**Remote code:** No, I am not using remote code. (Everything runs from the package; the extension only sends and receives JSON.)

**Data usage**, tick:

- **Authentication information:** the sign-in token for your Pluck account, kept on your computer.
- **Web history:** the addresses of pages you pluck, and, while you are signed in, the address of the page you are on, checked against your library so the icon can fill in.
- **Website content:** the text, title and images of pages you pluck, and YouTube transcripts when that setting is on.

All of it goes to one place: the Pluck server you are signed in to, which is getpluck.io unless you named your own in Options.

Leave the rest unticked (no personally identifiable information, health, financial, personal communications, location or user activity is collected by the extension).

Tick all three certifications: not sold to third parties, not used for purposes unrelated to the single purpose, not used for creditworthiness or lending.

**Privacy policy URL:** https://getpluck.io/privacy

## Distribution

- **Visibility:** Public.
- **Regions:** all.
- **Test instructions** (for the reviewer, under Account or Test instructions): "Sign in with the email link at https://getpluck.io using the test account below, then click the Pluck toolbar button on any article." Give a test account whose inbox the reviewer can read, or an API key: Options → "Use an API key instead" with a `pk_live_…` key made in Settings, API keys. Add: "The optional host permission is only asked for from Options: type another address under Server and click 'Use this server'. Chrome then asks for that one host. If no Pluck server answers there, the extension says so, keeps getpluck.io and removes the permission again."
