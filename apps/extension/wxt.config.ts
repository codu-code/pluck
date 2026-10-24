import { defineConfig } from "wxt";

// PLUCK_LOCAL=1 builds talk to a server on this machine (dev and e2e); store builds only know getpluck.io.
const local = process.env.PLUCK_LOCAL === "1";

export default defineConfig({
  modules: ["@wxt-dev/module-react"],
  vite: () => ({ define: { __DEFAULT_SERVER__: JSON.stringify(local ? "http://127.0.0.1:3000" : "https://getpluck.io") } }),
  manifest: ({ browser }) => ({
    name: "Pluck",
    description: "Pluck the page you are on into your Pluck library, with one click.",
    // unlimitedStorage: queued plucks keep their page (up to 4 MB each) and Chrome otherwise stops storage.local at 10 MB.
    // tabs: each tab's address, so the toolbar icon fills in on pages already plucked and "Pluck all tabs" can list them.
    permissions: ["activeTab", "tabs", "contextMenus", "storage", "unlimitedStorage", "scripting", "alarms"],
    host_permissions: ["https://getpluck.io/*", ...(local ? ["http://127.0.0.1/*", "http://localhost/*"] : [])],
    // Your own server asks for its address when you set it.
    optional_host_permissions: ["<all_urls>"],
    // Hollow until the page is plucked; lib/pluck.ts swaps in the filled icon per tab.
    action: { default_title: "Pluck this page", default_icon: { 16: "icon/empty-16.png", 32: "icon/empty-32.png" } },
    // Firefox: a fixed id (sign-in state and storage survive updates) and what a pluck sends to your server.
    ...(browser === "firefox"
      ? { browser_specific_settings: { gecko: { id: "extension@getpluck.io", strict_min_version: "128.0", data_collection_permissions: { required: ["browsingActivity", "websiteContent"] } } } }
      : {}),
    commands: {
      _execute_action: { suggested_key: { default: "Alt+Shift+P" }, description: "Pluck this page" },
      highlight: { suggested_key: { default: "Alt+Shift+H" }, description: "Pluck the selection as a highlight" },
    },
  }),
});
