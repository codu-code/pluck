# Build loop: Pluck for iPad

Launch: Thursday 14 January 2027. Branch `ipad-design`. The design is the `iPad-*` boards in `docs/handover/design` (PNGs in `docs/handover/ipad/screens`, sizes in `docs/handover/ipad/spec.png`). Copy the values exactly. Every colour is a token from `packages/ui/src/tokens.css`, which `apps/ios/lib/theme.ts` mirrors.

## How each iteration works

1. Read this file and `BLOCKED.md`. Pick the first slice that is not `done` and not `blocked`.
2. Build it. The iPhone layout must look and behave as it does now.
3. Run the gate, fix what fails, and note under the slice the last check that failed.
4. When the gate passes, tick the slice and make one signed-off commit on `ipad-design` (`git commit -s`, "iPad slice N: <name>"). Don't push and don't open a PR.
5. If a slice needs Niall (signing, a device, a decision on navigation), write it to `BLOCKED.md` and move on.

## The gate

1. `pnpm typecheck && pnpm lint && pnpm test` (Node 22 first on PATH, see Environment).
2. A Release build for the Simulator (`BUILD SUCCEEDED`), using the demo library from `docs/ios.md`.
3. Simulator screenshots set against the matching board in light and dark, on iPad Pro 13" (M5) in landscape and portrait and on iPad mini, plus an iPhone 17 screenshot of the same screen to show it hasn't changed. They go in `test-results/ios/ipad/`.
4. `pnpm e2e` and `pnpm design` before the last commit, and whenever a slice touches `packages/*`. The web isn't touched otherwise.

## Decision: a split view written in JS, not the native one

Expo Router 58 has `expo-router/unstable-split-view` (`SplitView`, `SplitView.Column`, `SplitView.Inspector`), built on react-native-screens' gamma `Split.Host`, which is `UISplitViewController`. It gives the system sidebar, the display-mode button and the edge swipe for free. It doesn't fit here:

- It can't sit inside another native navigator, and our root is a `Stack` with every modal and sheet on it. Using it means rebuilding the route tree.
- Its sidebar uses the system's sidebar material (Liquid Glass on iOS 26), not `--rail`, and its rows are UIKit's. The boards want exact widths (300, 380, 360, 320), our tokens and our row shapes.
- It collapses on the horizontal size class, not at 600 wide, and when it collapses it shows its own one-column navigation, not our tab bar. Switching between the two trees as a Stage Manager window is resized would remount every screen.
- It's `unstable-`, and the width props for the detail column need iOS 26.

So `app/(tabs)/_layout.tsx` checks the window width. Under 600 wide it returns today's `Tabs` and `TabBar`, untouched. At 600 and up it returns `Split`, a row of sidebar, list column and detail column. The same screens fill the middle. The detail column is the Item reader or the List, taken out of their routes as components so a route and a column share one body. Tapping a row goes through `useOpen()`: on iPhone it pushes `/items/<id>` as it does now, and on iPad it shows the Item in the detail column. Deep links (`/items/…`, `/lists/…`) still push full-screen on iPad, which works and is what a link from Safari should do.

## Slices

| # | Status | Slice | Check |
|---|---|---|---|
| 1 | done | Turn on iPad: `supportsTablet: true`, every orientation on iPad (the iPhone stays portrait), the share extension on iPad too (`TARGETED_DEVICE_FAMILY` 1,2 and iPad sizes in its icon set via `scripts/icons.mjs`), `useWide()` (600 and up) and the layout switch, with the split shell holding the current screens | Builds; 13" in both orientations and mini open on the shell; under 600 (Split View) and iPhone show the tabs |
| 2 | done | The sidebar (iPad-Inbox, iPad-Spec): Inbox, Later, Lists with the person's Lists nested under it, Search, Archive, Bin, and Settings at the bottom; `--rail`, 300 wide in 13" landscape; in portrait and on mini it hides behind its button and slides over the list from the left, including from an edge swipe; the Pluck logo and + at the top | Board match, light and dark |
| 3 | done | List column and detail column: Inbox, Later and Archive in the middle (380, 360 portrait, 320 mini); the Item reader or the List in detail (640 text column, ticked entries folded, Undo toast); selected and hover states (`onHoverIn`), and hover swaps the time for Later, Archive and Tag | iPad-Inbox, iPad-List, iPad-Mini |
| 4 | done | Search, Settings (sections in the middle, the open section in detail), Sign in and the empty Inbox | iPad-Search, iPad-Settings, iPad-SignIn, iPad-Empty |
| 5 | done | Add and Note as a 580-wide form sheet | iPad-Add |
| 6 | done (hands-on check in BLOCKED.md) | Hardware keyboard: the iPad-Shortcuts set through `UIKeyCommand` so they show in the hold-⌘ overlay; a small Expo module (`modules/key-commands`) next to `modules/app-icon` | Simulator with a hardware keyboard, hold ⌘ |
| 7 | todo | App Store: real Simulator screenshots of the sample library (`docs/store/app-store.md`) in the AppStore-iPad-1 to 7 frames, keeping the text layer; exported with and without text | 2064 × 2752, seven of each |

## Notes from the slices

- **1 and 2 share a commit.** The split shell and its state (`components/split/context.ts`) were written for both, and pulling them apart would have left a slice that doesn't build.
- **Icons:** the share extension's icon set already had the iPad sizes, so `scripts/icons.mjs` had nothing new to write. The app icon is one 1024 universal image, which covers iPad.
- **The share extension now builds for iPad** (`TARGETED_DEVICE_FAMILY` 1,2). Before, a universal app would have had no Pluck in the iPad share sheet.
- **Simulator builds need `PLUCK_SERVER` at `xcodebuild` time** as well as at prebuild, because the app's config is embedded when it builds. Without it the demo key goes to getpluck.io and is refused. Ad-hoc signing (`CODE_SIGN_IDENTITY=-`, without `CODE_SIGNING_REQUIRED=NO`) keeps the Keychain group, so the session sticks.
- **Archive, Bin and Settings** open in the list column on iPad, with the tabs kept mounted underneath. Their back and Done buttons become the sidebar button there. Settings gets its iPad layout in slice 4.
- **The sidebar button** hides the sidebar in landscape too, as the board's button does. Turning the iPad puts it back the way that orientation has it.

- **Slice 3, where it differs from the board, and why.** The detail bar keeps Note (for a link) and the keep-offline mark beside the board's six tools, because both exist on iPhone and dropping them would lose features on iPad. The board's ⋯ in the list column starts selecting (the iPhone's long press). The List's ⋯ is left out: there's nothing on iPhone to put behind it yet. The List's share icon shares the public page, or opens who can see it for a private List.
- **Demo launch arguments for iPad** (demo builds only): `-demoDetail item:<id>` or `list:<id>`, `-demoSection archive|bin|settings`, `-demoSidebar 1`. They drive the Simulator checks and will drive the slice 7 screenshots.
- **The usage question is a 580-wide card on iPad,** not a sheet across the whole width.

- **Slice 4, where it differs from the board, and why.** Sign in keeps the 6-digit code ("Send my code") rather than the board's "Email me a link", because the iPhone app signs in with a code (CLAUDE.md, docs/ios.md). Only the board's layout is taken: one centred 440 column. Settings lists the app's own groups (Account, AI tools, Email in, Expiry, Library, Language, App icon, Privacy, Delete). The board's Import isn't in the app, and its "What it changed this week" has no API behind it yet. The AI tools group shows what the app has now.
- **Words that named the iPhone now name the iPad on an iPad.** Nine messages (Language hint, Not on this iPhone yet, the keep mark and its toasts, the Settings footnotes) are `{device, select, ipad {…} other {…}}`. The iPhone branch is the old text unchanged, in all ten languages. The share sheet has `queuedBodyPad` for "It's on your iPad", chosen in Swift by `userInterfaceIdiom`.
- **Action sheets on iPad** (`ActionSheetIOS` without an anchor) show as a centred popover with no arrow. React Native does that itself on iPad (`RCTActionSheetManager.mm`), so nothing needed changing.

- **Slice 5, where it differs from the board, and why.** Add on iPad has the board's header (Cancel, the title, a Pluck button), the Link, Note, Todo and Thing control, a title and the words, and the key hints. It leaves out the board's Tags, List and Status rows: creating an Item can't take them (`CreateItemBody`), and setting them in follow-up calls would break a pluck made offline, which waits in a queue that only knows how to make the Item. They're one tap away on the Item once it's made. The sheet is iOS's own form sheet (about 580 wide on iPad, centred, on the system scrim), so its height is the system's rather than the board's fixed top of 96. Note (an Item's note) stays a system page sheet.

- **Slice 6.** `modules/key-commands` adds `UIKeyCommand`s with titles to the root view controller. Each command's action goes up the responder chain to a `UIViewController` extension, which posts it to JS as `onKeyCommand`. `components/split/Shortcuts.tsx` registers them while the split view is showing and runs them. Commands marked `typing: false` (L, E, D, T, A, ⌘V, ↓, ↑) are taken away while a text field is being edited, so typing and pasting still work. Built, and launched on the Simulator. The keys themselves are a hands-on check (BLOCKED.md).

## Helps the iPhone too (proposals, not done without a yes)

The iPhone stays exactly as it is in this work. These came up along the way and would help it on its own merits:

- **Keyboard shortcuts on iPhone.** The `UIKeyCommand` module from slice 6 works on an iPhone with a keyboard as well. It changes nothing on screen.
- **Pointer hover.** `onHoverIn` does nothing on iPhone, so it's safe to share.
- **Tags, a List and a Status when making an Item** (iPad-Add's three rows). Needs `tagIds`, `listId` and `status` on `CreateItemBody` and on the queued body, so an offline pluck keeps them. Then both Add sheets can offer them.

## Environment

- Node 22 isn't first on PATH: `export PATH="$HOME/.nvm/versions/node/v22.23.4/bin:$PATH"`.
- OrbStack, not Docker Desktop: `DOCKER_CONTEXT=orbstack`.
- Ports: Mongo 27027, e2e web 3300, dev web 3000, design boards 4100.
