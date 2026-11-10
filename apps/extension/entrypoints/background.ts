import { finishSignIn } from "@/lib/auth";
import { drain, pluckForPopup, pluckTab, pluckUrl, refreshBadge, resume, type PluckOutcome } from "@/lib/pluck";
import { settings } from "@/lib/store";
import { t } from "@/lib/t";

// Removing the extension opens a goodbye page on the person's server, which counts it with nobody named.
const sayBye = async () => void (await browser.runtime.setUninstallURL(`${(await settings()).server}/api/v1/extension/bye`));

// The service worker can stop after 30 seconds idle: every handler reads what it needs from storage.
export default defineBackground(() => {
  browser.runtime.onStartup.addListener(() => void sayBye());
  browser.storage.onChanged.addListener((change) => void (change.settings && sayBye())); // a new server in Options
  browser.runtime.onInstalled.addListener(() => {
    void sayBye();
    browser.contextMenus.removeAll().then(() => {
      browser.contextMenus.create({ id: "pluck-link", title: t("menu.link"), contexts: ["link"] });
      browser.contextMenus.create({ id: "pluck-selection", title: t("menu.selection"), contexts: ["selection"] });
      browser.contextMenus.create({ id: "pluck-image", title: t("menu.image"), contexts: ["image"] });
      browser.contextMenus.create({ id: "pluck-page", title: t("menu.page"), contexts: ["page"] });
    });
  });

  browser.contextMenus.onClicked.addListener((info, tab) => void onMenu(info, tab));
  browser.runtime.onMessage.addListener(pluckForPopup);
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
  // Every start of the worker: a browser start and an install or update are among them (onStartup and onInstalled
  // above wake it), and those are when the alarm is lost.
  void resume();

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
