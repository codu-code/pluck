import { defineConfig } from "wxt";

// PLUCK_LOCAL=1 builds talk to a server on this machine (dev and e2e); PLUCK_SERVER=https://your.server builds
// one for your own server (docs/self-host.md); store builds only know getpluck.io.
const local = process.env.PLUCK_LOCAL === "1";
const server = new URL(process.env.PLUCK_SERVER ?? (local ? "http://127.0.0.1:3000" : "https://getpluck.io")).origin;

export default defineConfig({
  modules: ["@wxt-dev/module-react"],
  vite: () => ({ define: { __DEFAULT_SERVER__: JSON.stringify(server) } }),
  manifest: ({ browser }) => ({
    // The name is the brand in every language; the rest comes from public/_locales (node scripts/i18n-sync.mjs).
    name: "Pluck",
    default_locale: "en",
    description: "__MSG_description__",
    // unlimitedStorage: queued plucks keep their page (up to 4 MB each) and Chrome otherwise stops storage.local at 10 MB.
    // tabs: each tab's address, so the toolbar icon fills in on pages already plucked and "Pluck all tabs" can list them.
    permissions: ["activeTab", "tabs", "contextMenus", "storage", "unlimitedStorage", "scripting", "alarms"],
    // One server only: no all-sites permission, so the store review stays short.
    host_permissions: [`${server}/*`, ...(local ? ["http://127.0.0.1/*", "http://localhost/*"] : [])],
    // Hollow until the page is plucked; lib/pluck.ts swaps in the filled icon per tab.
    action: { default_title: "__MSG_pluckPage__", default_icon: { 16: "icon/empty-16.png", 32: "icon/empty-32.png" } },
    // Firefox: a fixed id (sign-in state and storage survive updates) and what a pluck sends to your server.
    ...(browser === "firefox"
      ? { browser_specific_settings: { gecko: { id: "extension@getpluck.io", strict_min_version: "128.0", data_collection_permissions: { required: ["browsingActivity", "websiteContent"] } } } }
      : {}),
    commands: {
      _execute_action: { suggested_key: { default: "Alt+Shift+P" }, description: "__MSG_pluckPage__" },
      highlight: { suggested_key: { default: "Alt+Shift+H" }, description: "__MSG_pluckSelection__" },
    },
  }),
});
