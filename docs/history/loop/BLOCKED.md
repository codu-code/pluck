# Blocked

Things the loop needs from a human. Newest first. Remove an entry once it is resolved.

## Slice 14: load the extension unpacked in Chrome, once

Everything is built and the Playwright suite drives it in Chromium; what is left is a person using it in a real Chrome.

1. `pnpm stack`, then run the app on port 3000 (`pnpm dev`, or `pnpm --filter @pluck/web build && pnpm --filter @pluck/web exec next start -p 3000`).
2. `PLUCK_LOCAL=1 pnpm --filter @pluck/extension build`
3. `chrome://extensions` → Developer mode on → Load unpacked → `apps/extension/.output/chrome-mv3`. Pin Pluck to the toolbar.
4. Click Pluck on any page → Sign in. The email link is in Mailpit (http://127.0.0.1:8035). Allow on the consent screen.
5. Try: clicking Pluck on an article (tags, kind, note, To list, Later), Alt+Shift+P, right-click a link, an image and a selection, "Pluck all N tabs" (Chrome asks for permission once), a YouTube video (the transcript lands in the item), and Options (server, key, toggles). Turn Wi-Fi off and pluck to see the queue dot, then back on (it retries within a minute).

Tell the loop what looked wrong, or say it is fine and slice 14 is marked done.
