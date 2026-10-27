import type { Item, Kind, List, PluckResponse, Status, Tag } from "@pluck/shared-schemas";
import { KindGlyph, Logo } from "@pluck/ui";
import { useEffect, useState, type ReactNode } from "react";
import { useFormatter, useTranslations } from "use-intl";
import { api, openInPluck, Refused, Unreachable } from "@/lib/api";
import { isSignedIn, startSignIn } from "@/lib/auth";
import { markTab, pluckTab, type PluckOutcome } from "@/lib/pluck";
import { pageShortcut } from "@/lib/shortcut";
import { get, set } from "@/lib/store";

type Tab = { id?: number; url?: string; title?: string; windowId?: number };
type View =
  | { k: "loading" }
  | { k: "signedOut" }
  | { k: "nothing" }
  | { k: "message"; text: string }
  | { k: "item"; item: Item; fresh: boolean; tips: boolean } // fresh: plucked just now; otherwise it was already there
  | { k: "removed"; item: Item }
  | { k: "queued"; count: number };

const KINDS: Kind[] = ["link", "video", "pdf", "image", "todo", "note", "thing"];
const LINK_KINDS = new Set<Kind>(["link", "video", "pdf", "image"]);
const MOVES = { inbox: "popup.plucked.inbox", later: "popup.plucked.later", archived: "popup.plucked.archive" } as const; // where an Item can go, and its button
const DAY_MONTH = { day: "numeric", month: "short" } as const;

// The tab to pluck: the active one, or ?tab=<id> (the e2e suite opens the popup as a page).
async function targetTab(): Promise<Tab | undefined> {
  const id = Number(new URLSearchParams(location.search).get("tab"));
  if (id) return browser.tabs.get(id);
  return (await browser.tabs.query({ active: true, currentWindow: true }))[0];
}

// Opening the popup plucks the page. A page already in the library opens on its Item instead, with the same tools.
export function Popup() {
  const t = useTranslations("extension");
  const [view, setView] = useState<View>({ k: "loading" });

  const show = async (outcome: PluckOutcome) => {
    if (outcome.state === "queued") return setView({ k: "queued", count: outcome.count });
    if (outcome.state === "refused") return setView({ k: "message", text: outcome.message });
    const tips = !(await get("seenTips"));
    if (tips) await set({ seenTips: true });
    setView({ k: "item", item: outcome.item, fresh: true, tips });
  };

  useEffect(() => {
    (async () => {
      if (!(await isSignedIn())) return setView({ k: "signedOut" });
      const tab = await targetTab();
      if (!tab?.url || !/^https?:\/\//.test(tab.url)) return setView({ k: "nothing" });
      try {
        const { item } = await api<{ item: Item | null }>(`/api/v1/items/lookup?url=${encodeURIComponent(tab.url)}`);
        if (item) {
          if (tab.id !== undefined) await markTab(tab.id, true);
          return setView({ k: "item", item, fresh: false, tips: false });
        }
      } catch (e) {
        if (!(e instanceof Unreachable)) return setView({ k: "signedOut" });
      }
      await show(await pluckTab(tab));
    })().catch(() => setView({ k: "message", text: t("errors.tryAgain") }));
  }, []);

  // Into the bin (30 days). A pluck made just now is undone and the popup closes; an older one can be put back.
  const remove = async (item: Item, fresh: boolean) => {
    try {
      await api(`/api/v1/items/${item.id}`, { method: "DELETE" });
    } catch (e) {
      // A sign-in from before Delete was here, or an API key without library:delete.
      return setView({ k: "message", text: e instanceof Refused && e.status === 403 ? t("popup.deleteNeedsSignIn") : t("errors.tryAgain") });
    }
    const tab = await targetTab();
    if (tab?.id !== undefined) await markTab(tab.id, false);
    if (fresh) window.close();
    else setView({ k: "removed", item });
  };

  const putBack = async (item: Item) => {
    const { item: back } = await api<{ item: Item }>(`/api/v1/items/${item.id}/restore`, { method: "POST" });
    const tab = await targetTab();
    if (tab?.id !== undefined) await markTab(tab.id, true);
    setView({ k: "item", item: back, fresh: false, tips: false });
  };

  switch (view.k) {
    case "loading":
      // The Brand board's moment: the dashes pop off the k while the page is plucked.
      return (
        <div className="card center plucking" aria-busy="true">
          <Logo size={34} />
          <span className="meta" role="status">{t("popup.plucking")}</span>
        </div>
      );
    case "signedOut":
      return (
        <div className="card center">
          <Logo size={30} />
          <p className="lede">{t("popup.signedOut.lede")}</p>
          <button type="button" className="primary wide" onClick={async () => { await startSignIn(); window.close(); }}>{t("popup.signedOut.signIn")}</button>
          <button type="button" className="quiet" onClick={() => browser.runtime.openOptionsPage()}>{t("popup.signedOut.ownServer")}</button>
        </div>
      );
    case "nothing":
      return (
        <Shell>
          <div className="card">
            <b className="title">{t("errors.nothing")}</b>
            <span className="meta">{t("popup.nothingHint")}</span>
          </div>
        </Shell>
      );
    case "message":
      return (
        <Shell>
          <div className="card">
            <b className="title">{view.text}</b>
          </div>
        </Shell>
      );
    case "queued":
      return (
        <Shell>
          <div className="card row">
            <span aria-hidden="true" className="queued-dot" />
            <div className="stack">
              <b>{t("popup.queued.title")}</b>
              <span className="meta">{t("popup.queued.count", { count: view.count })}</span>
            </div>
          </div>
        </Shell>
      );
    case "removed":
      return (
        <Shell>
          <div className="card">
            <div className="stack">
              <b className="title" role="status">{t("popup.removed.title")}</b>
              <span className="meta">{t("popup.removed.body")}</span>
            </div>
            <button type="button" className="secondary" onClick={() => void putBack(view.item).catch(() => setView({ k: "message", text: t("errors.tryAgain") }))}>{t("popup.removed.back")}</button>
          </div>
        </Shell>
      );
    case "item":
      return <ItemPanel key={view.item.id} initial={view.item} fresh={view.fresh} tips={view.tips} remove={(item) => void remove(item, view.fresh)} />;
  }
}

// The bar on every signed-in view: the wordmark opens Pluck, the cog opens Options (account, sign out, server).
function Shell({ children }: { children: ReactNode }) {
  const t = useTranslations("extension");
  return (
    <div className="popup">
      <div className="bar">
        <button type="button" className="home" aria-label={t("popup.home")} title={t("popup.home")} onClick={() => openInPluck("/inbox")}>
          <Logo size={18} />
        </button>
        <button type="button" className="cog" aria-label={t("popup.settings")} title={t("popup.settings")} onClick={() => browser.runtime.openOptionsPage()}>
          <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        </button>
      </div>
      {children}
    </div>
  );
}

// One panel for a page in the library, plucked just now or weeks ago: tags, Kind, a List, a note, where it goes next.
function ItemPanel({ initial, fresh, tips, remove }: { initial: Item; fresh: boolean; tips: boolean; remove: (item: Item) => void }) {
  const t = useTranslations("extension");
  const format = useFormatter();
  const [item, setItem] = useState(initial);
  const [tags, setTags] = useState<Tag[]>([]);
  const [lists, setLists] = useState<List[]>([]);
  const [lastListId, setLastListId] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const [note, setNote] = useState(initial.note ?? "");
  const [listId, setListId] = useState("");
  const [tabCount, setTabCount] = useState(0);
  const [footer, setFooter] = useState<string | null>(null);
  const [keys, setKeys] = useState("");

  useEffect(() => {
    pageShortcut().then(setKeys);
    api<{ tags: Tag[] }>("/api/v1/tags").then((r) => setTags(r.tags)).catch(() => {});
    api<{ lists: List[] }>("/api/v1/lists").then((r) => setLists(r.lists)).catch(() => {});
    get("lastListId").then(setLastListId);
    browser.tabs.query({ currentWindow: true }).then((t) => setTabCount(t.length));
  }, []);

  const patch = async (body: Record<string, unknown>) => setItem((await api<{ item: Item }>(`/api/v1/items/${item.id}`, { method: "PATCH", json: body })).item);
  const move = async (status: Status) => {
    await patch({ status });
    window.close();
  };
  const toggleTag = (id: string) => patch({ tagIds: item.tagIds.includes(id) ? item.tagIds.filter((t) => t !== id) : [...item.tagIds, id] });
  const typed = filter.trim();
  const exact = tags.find((t) => t.name.toLowerCase() === typed.toLowerCase());
  // Enter or the "Add" chip: the tag with that name (made if it is new), on this Item.
  const addTag = async () => {
    if (!typed) return;
    if (exact) {
      if (!item.tagIds.includes(exact.id)) await toggleTag(exact.id);
    } else {
      const { tag } = await api<{ tag: Tag }>("/api/v1/tags", { json: { name: typed } });
      setTags((all) => [...all, tag]);
      await patch({ tagIds: [...item.tagIds, tag.id] });
    }
    setFilter("");
  };
  const shownTags = [
    ...tags.filter((t) => item.tagIds.includes(t.id)),
    ...tags.filter((t) => !item.tagIds.includes(t.id) && t.name.toLowerCase().includes(typed.toLowerCase())),
  ].slice(0, 8);
  const orderedLists = [...lists].sort((a, b) => Number(b.id === lastListId) - Number(a.id === lastListId));
  const listName = t("popup.tabs.listName", { date: format.dateTime(new Date(), DAY_MONTH) });

  const addToList = async (id: string) => {
    setListId(id);
    if (!id) return;
    await api(`/api/v1/lists/${id}/items`, { json: { itemId: item.id } });
    await set({ lastListId: id });
  };

  const pluckAllTabs = async () => {
    const urls = (await browser.tabs.query({ currentWindow: true })).map((t) => t.url).filter((u): u is string => Boolean(u && /^https?:\/\//.test(u))).slice(0, 50);
    if (!urls.length) return;
    setFooter(t("popup.tabs.plucking"));
    try {
      const { results } = await api<PluckResponse>("/api/v1/items", { json: { urls, source: "extension" } });
      await api("/api/v1/lists", { json: { name: listName, items: results.map((r) => ({ itemId: r.item.id })) } });
      setFooter(t("popup.tabs.done", { count: results.length, name: listName }));
    } catch {
      setFooter(t("popup.tabs.failed"));
    }
  };

  return (
    <Shell>
      <div className="head">
        {fresh ? (
          <span className="tick" aria-hidden="true">
            <svg width="16" height="16" viewBox="0 0 16 16"><path d="M3.5 8.5l3 3 6-7" fill="none" stroke="#151A13" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </span>
        ) : (
          <span className="tick kept"><KindGlyph kind={item.kind} label={t(`kinds.${item.kind}`)} /></span>
        )}
        <div className="head-text">
          {fresh ? (
            <>
              <b role="status">{t("popup.plucked.title")}</b>
              {!tips && <span className="meta ellipsis">{item.title}</span>}
            </>
          ) : (
            <>
              <b className="ellipsis">{item.title}</b>
              <span className="meta ellipsis">{t("popup.already.meta", { date: format.dateTime(new Date(item.createdAt), DAY_MONTH), status: t(`status.${item.status}`) })}</span>
            </>
          )}
        </div>
        {!tips && <button type="button" className="small" onClick={() => remove(item)}>{fresh ? t("popup.plucked.undo") : t("popup.plucked.delete")}</button>}
      </div>
      {tips ? (
        <div className="tips">
          <span>{t("popup.plucked.tips.opening")}</span>
          {keys && <span>{t("popup.plucked.tips.shortcut", { keys })}</span>}
          <span>{t("popup.plucked.tips.rightClick")}</span>
        </div>
      ) : (
        <>
          <div className="body">
            <label className="field">
              <span className="label">{t("popup.plucked.tags")}</span>
              <input
                type="text"
                placeholder={t("popup.plucked.tagsPlaceholder")}
                value={filter}
                maxLength={40}
                onChange={(e) => setFilter(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && void addTag()}
              />
            </label>
            {(shownTags.length > 0 || (typed && !exact)) && (
              <div className="chips">
                {shownTags.map((t) => (
                  <button key={t.id} type="button" className="chip" aria-pressed={item.tagIds.includes(t.id)} onClick={() => void toggleTag(t.id)}>{t.name}</button>
                ))}
                {typed && !exact && <button type="button" className="chip new" onClick={() => void addTag()}>{t("popup.plucked.newTag", { name: typed })}</button>}
              </div>
            )}
            <div role="group" aria-label={t("popup.plucked.kind")} className="kinds">
              {KINDS.map((k) => (
                <button
                  key={k}
                  type="button"
                  className="kind"
                  title={t(`kinds.${k}`)}
                  aria-label={t(`kinds.${k}`)}
                  aria-pressed={item.kind === k}
                  disabled={!LINK_KINDS.has(k)}
                  onClick={() => void patch({ kind: k })}
                >
                  <KindGlyph kind={k} label={t(`kinds.${k}`)} />
                </button>
              ))}
            </div>
            <label className="inline-field">
              <span className="label list-label">{t("popup.plucked.toList")}</span>
              <select value={listId} onChange={(e) => void addToList(e.target.value)}>
                <option value="">{t("popup.plucked.noList")}</option>
                {orderedLists.map((l) => <option key={l.id} value={l.id}>{l.id === lastListId ? t("popup.plucked.lastUsed", { name: l.name }) : l.name}</option>)}
              </select>
            </label>
            <label className="note">
              <span className="visually-hidden">{t("popup.plucked.note")}</span>
              <input
                type="text"
                placeholder={t("popup.plucked.notePlaceholder")}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                onBlur={() => note !== (item.note ?? "") && void patch({ note: note.trim() || null })}
                onKeyDown={(e) => e.key === "Enter" && (e.currentTarget as HTMLInputElement).blur()}
              />
            </label>
            <div className="actions">
              {(Object.keys(MOVES) as (keyof typeof MOVES)[]).filter((s) => s !== item.status).map((s) => (
                <button key={s} type="button" className="secondary grow" onClick={() => void move(s)}>{t(MOVES[s])}</button>
              ))}
              <button type="button" className="primary grow-more" onClick={() => openInPluck(`/items/${item.id}`)}>{t("popup.plucked.open")}</button>
            </div>
          </div>
          <button type="button" className="footer" disabled={footer !== null || tabCount < 2} onClick={() => void pluckAllTabs()}>
            {footer ?? t("popup.tabs.all", { count: tabCount, name: listName })}
          </button>
        </>
      )}
    </Shell>
  );
}
