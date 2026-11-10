import { isTask, withReferral } from "@pluck/shared-schemas";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useEffect, useRef } from "react";
import { Share } from "react-native";
import { useTranslations } from "use-intl";
import { keys, library, pluck, queryClient, type FullItem } from "@/lib/data";
import { keyCommands, type KeyCommand } from "@/modules/key-commands";
import { toast } from "../Toast";
import { shown, useSplit } from "./context";
import { useGo } from "./Sidebar";

// The iPad's keyboard (iPad-Shortcuts board), held ⌘ to see: the open Item's moves on single letters, the places on
// ⌘ and a number, and plucking. Mounted with the split view, so a narrow window (the iPhone layout) has none.
export function Shortcuts() {
  const tr = useTranslations("ios");
  const split = useSplit();
  const go = useGo();
  const run = useRef<(id: string) => void>(() => {});

  const commands: (KeyCommand & { run: () => void })[] = [
    // Items: the one open in the detail column.
    { id: "later", input: "l", title: tr("actions.later"), typing: false, run: () => move("later") },
    { id: "archive", input: "e", title: tr("actions.archive"), typing: false, run: () => move("archived") },
    { id: "done", input: "d", title: tr("common.done"), typing: false, run: () => move("done") },
    { id: "tag", input: "t", title: tr("actions.tags"), typing: false, run: () => pick("tags") },
    { id: "list", input: "a", title: tr("actions.addToList"), typing: false, run: () => pick("lists") },
    { id: "original", input: "o", modifiers: ["command"], title: tr("item.openOriginal"), run: () => { const i = open(); if (i?.url) void WebBrowser.openBrowserAsync(withReferral(i.url)); } },
    { id: "share", input: "s", modifiers: ["command", "shift"], title: tr("actions.share"), run: () => { const i = open(); if (i) void Share.share(i.url ? { url: i.url } : { message: i.title }); } },
    // Go to.
    { id: "inbox", input: "1", modifiers: ["command"], title: tr("tabs.inbox"), run: () => go("inbox") },
    { id: "goLater", input: "2", modifiers: ["command"], title: tr("tabs.later"), run: () => go("later") },
    { id: "lists", input: "3", modifiers: ["command"], title: tr("tabs.lists"), run: () => go("lists") },
    { id: "goArchive", input: "4", modifiers: ["command"], title: tr("archive.title"), run: () => go("archive") },
    { id: "search", input: "f", modifiers: ["command"], title: tr("tabs.search"), run: () => go("search") },
    { id: "settings", input: ",", modifiers: ["command"], title: tr("settings.title"), run: () => go("settings") },
    // Pluck.
    { id: "paste", input: "v", modifiers: ["command"], title: tr("ipad.keys.paste"), typing: false, run: () => void paste() },
    { id: "note", input: "n", modifiers: ["command"], title: tr("ipad.add.new", { kind: "note" }), run: () => router.push({ pathname: "/add", params: { kind: "note" } }) },
    { id: "todo", input: "n", modifiers: ["command", "shift"], title: tr("ipad.add.new", { kind: "todo" }), run: () => router.push({ pathname: "/add", params: { kind: "todo" } }) },
    { id: "sidebar", input: "s", modifiers: ["command", "control"], title: tr("ipad.keys.sidebar"), run: () => split?.setSidebar(!split.sidebar) },
    { id: "next", input: "down", title: tr("ipad.keys.next"), typing: false, run: () => step(1) },
    { id: "previous", input: "up", title: tr("ipad.keys.previous"), typing: false, run: () => step(-1) },
    // In the Add sheet.
    { id: "submit", input: "return", modifiers: ["command"], title: tr("add.submit"), run: () => shown.sheet?.submit() },
    { id: "escape", input: "escape", title: tr("common.cancel"), run: () => (shown.sheet ? router.back() : !split?.pinned && split?.sidebar ? split.setSidebar(false) : undefined) },
  ];

  const open = () => (split?.detail?.kind === "item" ? queryClient.getQueryData<FullItem>(keys.item(split.detail.id))?.item : undefined);
  const move = (to: "later" | "archived" | "done") => {
    const item = open();
    if (!item || (to === "done" && !isTask(item.kind))) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const failed = () => toast(tr("items.moveFailed")); // in place of the toast that said it had moved
    void library.move([item.id], to).then(() => queryClient.invalidateQueries({ queryKey: ["items"] })).catch(failed);
    toast(tr(`moved.${to}`), () => void library.move([item.id], item.status).then(() => queryClient.invalidateQueries({ queryKey: ["items"] })).catch(failed));
    step(1);
  };
  const pick = (mode: "tags" | "lists") => {
    const item = open();
    if (item) router.push({ pathname: "/pick", params: { mode, id: item.id } });
  };
  const step = (by: 1 | -1) => {
    const at = split?.detail?.kind === "item" ? shown.rows.indexOf(split.detail.id) : -1;
    const next = shown.rows[at < 0 ? 0 : at + by];
    if (next) split?.show({ kind: "item", id: next });
  };
  // Paste and pluck: iOS may ask once whether Pluck can paste, as it does for any app reading the clipboard.
  const paste = async () => {
    const text = (await Clipboard.getStringAsync().catch(() => "")).trim();
    if (!text) return;
    const { queued } = await pluck({ text }).catch(() => ({ queued: null }));
    if (queued === null) return void toast(tr("add.failed"));
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    toast(tr(queued ? "add.queued" : "add.plucked"));
  };

  run.current = (id) => commands.find((c) => c.id === id)?.run();
  const titles = commands.map((c) => c.title).join("|"); // set again only if the words change (another language)
  useEffect(() => {
    void keyCommands.set(commands.map(({ run: _, ...c }) => c));
    const sub = keyCommands.listen((id) => run.current(id));
    return () => {
      sub.remove();
      void keyCommands.set([]);
    };
  }, [titles]);
  return null;
}
