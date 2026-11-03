# Pluck for iPad: design handover

Launch date: 14 January 2027. The boards are the source of truth. Copy values from them exactly and never round.

## Where things are

- `docs/handover/design/iPad-*.dc.html`: ten boards in iPad points (1 px = 1 pt). Each has a Theme tweak (light or dark), and every colour is a token from `packages/ui/src/tokens.css`. To view one, serve the folder (`python3 -m http.server 4100` from `docs/handover/design`, using `support.js`).
  - Inbox: 13 in landscape, three columns, item open, a hovered row
  - List: 13 in portrait, ticked entries folded, Undo toast
  - Search: results with highlights
  - Add: Add and Note as a form sheet
  - Settings: sections in the middle column, AI tools in detail
  - SignIn
  - Empty: the empty Inbox
  - Mini: iPad mini portrait, two columns
  - Shortcuts: hold ⌘ for the overlay
  - Spec: every size
- `screens/light`, `screens/dark`: the same boards as PNGs. `spec.png` is the Spec board.
- `docs/store/ipad`: the seven App Store screenshots (2064 × 2752), with text and art only, plus `strings.en.json`.
- `docs/store/featuring`: featuring key art as layered SVG and PNG.
- `docs/store/promo`: the iPad teaser (4:5) and the 9:16 promo.

## Layout rules

- 13 in landscape: sidebar 300, list 380, detail fills. Reader text column 640 max, centred.
- 13 in portrait: the sidebar hides behind its button and comes over the list from the left edge. List 360.
- iPad mini portrait: list 320, detail fills. Sidebar as an overlay.
- Under 600 wide (Split View, Stage Manager): one column, the iPhone layout and tab bar.
- Sidebar order: Inbox, Later, Lists (the person's Lists nested under it), Search, then Archive and Bin, and Settings at the bottom.
