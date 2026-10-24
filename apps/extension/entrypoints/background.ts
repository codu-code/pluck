import { finishSignIn } from "@/lib/auth";
import { drain, pluckTab, pluckUrl, refreshBadge, type PluckOutcome } from "@/lib/pluck";

// The service worker can stop after 30 seconds idle: every handler reads what it needs from storage.
export default defineBackground(() => {
  browser.runtime.onInstalled.addListener(() => {
    browser.contextMenus.removeAll().then(() => {
      browser.contextMenus.create({ id: "pluck-link", title: "Pluck link", contexts: ["link"] });
      browser.contextMenus.create({ id: "pluck-selection", title: "Pluck selection as highlight", contexts: ["selection"] });
      browser.contextMenus.create({ id: "pluck-image", title: "Pluck image", contexts: ["image"] });
      browser.contextMenus.create({ id: "pluck-page", title: "Pluck page", contexts: ["page"] });
    });
  });

  browser.contextMenus.onClicked.addListener((info, tab) => void onMenu(info, tab));
  browser.commands.onCommand.addListener(async (command) => {
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    if (command === "highlight" && tab) await pluckTab(tab, { asHighlight: true });
  });

  browser.tabs.onUpdated.addListener(async (tabId, change, tab) => {
    if (change.url && (await finishSignIn(change.url))) return;
    if (change.status === "complete") await refreshBadge(tabId, tab.url);
  });
  browser.tabs.onActivated.addListener(async ({ tabId }) => refreshBadge(tabId, (await browser.tabs.get(tabId)).url));
  browser.alarms.onAlarm.addListener((alarm) => void (alarm.name === "drain" && drain()));

  // For the e2e suite, which cannot click a native context menu or wait out an alarm.
  (globalThis as unknown as { pluckTest: object }).pluckTest = { menu: onMenu, drain };
});

type MenuClick = { menuItemId: string | number; linkUrl?: string; srcUrl?: string };

async function onMenu(info: MenuClick, tab?: { id?: number; url?: string; title?: string; windowId?: number }): Promise<PluckOutcome | null> {
  switch (info.menuItemId) {
    case "pluck-link":
      return info.linkUrl ? pluckUrl(info.linkUrl) : null;
    case "pluck-image":
      return info.srcUrl ? pluckUrl(info.srcUrl) : null;
    case "pluck-selection":
      return tab ? pluckTab(tab, { asHighlight: true }) : null;
    case "pluck-page":
      return tab ? pluckTab(tab) : null;
    default:
      return null;
  }
}
