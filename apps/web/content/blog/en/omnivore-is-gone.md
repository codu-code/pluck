---
title: Omnivore is gone. The pages in your zip aren’t.
description: If you kept your Omnivore export, Pluck reads the pages straight out of the zip. Even the ones whose sites are gone.
keywords: Omnivore alternative, Omnivore export, import Omnivore zip, Omnivore shut down
---

Omnivore's hosted service shut down in November 2024. The team joined another company, and users had about two weeks to get their data out.

If you exported in time, you have a zip. Keep it. Most of what you kept in Omnivore is in there as the page itself, not just a link to it.

![An Omnivore zip opened out into whole pages, one of them open in the Pluck reader.](/blog/omnivore-is-gone/hero.png)

## What's in the zip

An Omnivore export is a folder of metadata files and, for most things you kept, the page as HTML.

That matters now. Some of those sites have moved, changed or gone, and your zip still has what they said.

## Bring it across

1. [Sign in to Pluck](/signin). You get a link by email. There's no password.
2. Open Settings, then Import and export.
3. Pick Omnivore (zip) and drop the file in.

The import runs in the background, so you can close the tab.

## What comes with it

- Every link, with its title.
- Your labels, as tags.
- The date you kept each one.
- The page text, read straight from the zip. Pluck doesn't go back to the site for these, so a page whose site is gone still arrives whole.

For anything without a page in the zip, Pluck fetches the page again, a few at a time.

## Where it lands

In the Archive, marked Imported, and all searchable, page text included. Your Inbox stays empty until you pluck something new.

## Open source wasn't enough

Omnivore was open source, and it still went. The code stayed public. The service didn't, and running it yourself was a project.

So public code is only half of it. Here's the other half:

- **Running your own takes one command.** It's `docker compose up -d` from the [repository](/open-source). The web app, the iPhone app and your AI all work with your server, and the Chrome extension builds for it with one more command.
- **Export works today.** Every item comes out as JSON, with your notes and highlights, plus a Markdown file for each item and each list.
- **Pluck keeps the page, not just the link.** It's kept when you pluck it, so the next shutdown takes less with it.

## Not just Omnivore

The same screen takes a Pocket CSV, a Raindrop CSV and the bookmarks file your browser exports. Bring all of them. Anything that's in two files becomes one item.

Then pluck the next thing from your phone, Chrome, email or [your AI](/connect).

Still here when the site isn't.
