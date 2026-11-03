# Blocked: needs Niall

## Slice 6: try the keyboard by hand (5 minutes, Simulator or an iPad with a keyboard)

The shortcuts are built and registered (`modules/key-commands`), and the app launches with them. Pressing keys in the Simulator means taking over the Mac's keyboard and mouse, so this is yours to try:

1. Run the app on the iPad Pro 13" Simulator (I/O, Keyboard, Connect Hardware Keyboard should be on) or an iPad with a Magic Keyboard.
2. Hold ⌘. The overlay should list Pluck's commands: Later, Archive, Done, Tags, Add to List, Open original, Share; Inbox, Later, Lists, Archive, Search, Settings; Paste and pluck, New Note, New Todo, Show or hide sidebar, Next, Previous; Pluck it and Cancel.
3. With an Item open: L, E and D move it and open the next one; T and A open Tags and Lists; ↓ and ↑ walk the list column.
4. ⌘1 to ⌘4, ⌘F and ⌘, go to the places. ⌘N and ⌘⇧N open Add on a Note or a Todo. In Add, ⌘↩ plucks and Esc cancels.
5. Type in Search or Add: the letters L, E, D, T, A and ⌘V must type and paste as normal (they step aside while a field is being edited).
6. ⌘V outside a field plucks what is on the clipboard. iOS may ask once whether Pluck can paste.

The overlay lists the commands in one group under Pluck. The board draws three columns (Items, Go to, Pluck). Groups need `UIMenuBuilder` in the app delegate, which an Expo module can't reach without a config plugin. Say if you want that.
