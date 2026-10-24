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
    permissions: ["activeTab", "contextMenus", "storage", "unlimitedStorage", "scripting", "alarms"],
    host_permissions: ["https://getpluck.io/*", ...(local ? ["http://127.0.0.1/*", "http://localhost/*"] : [])],
    // Your own server, the badge on every page and "Pluck all tabs" ask for these when first needed.
    optional_host_permissions: ["<all_urls>"],
    action: { default_title: "Pluck this page" },
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
