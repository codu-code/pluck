// The extension's shortcuts as Chrome shows them: its "Alt" is Option on a Mac, so ⌥⇧P there and Alt+Shift+P elsewhere.
// "Macintosh", not "Mac OS X": an iPhone's user agent says "like Mac OS X".
export const isMacAgent = (ua: string | null | undefined) => /Macintosh/.test(ua ?? "");
// As keycaps (a Mac's keys carry both the symbol and the name), and as text in a sentence.
export const shortcutKeys = (mac: boolean, key: "P" | "H") => (mac ? ["⌥ Option", "⇧ Shift", key] : ["Alt", "Shift", key]);
export const shortcutText = (mac: boolean, key: "P" | "H") => (mac ? `⌥⇧${key}` : `Alt+Shift+${key}`);
