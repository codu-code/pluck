// The "Pluck this page" shortcut as the browser shows it (⌥⇧P on a Mac), including one the person changed;
// the default when none is set.
export async function pageShortcut(): Promise<string> {
  const set = (await browser.commands.getAll()).find((c) => c.name === "_execute_action")?.shortcut;
  return set || (/Mac/.test(navigator.userAgent) ? "⌥⇧P" : "Alt+Shift+P");
}
