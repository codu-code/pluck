import type { Item, Kind, List, PluckResponse, Tag } from "@pluck/shared-schemas";
import { KindGlyph, Logo } from "@pluck/ui";
import { useEffect, useState } from "react";
import { useFormatter, useTranslations } from "use-intl";
import { api, openInPluck, Unreachable } from "@/lib/api";
import { startSignIn } from "@/lib/auth";
import { markTab, pluckTab, type PluckOutcome } from "@/lib/pluck";
import { get, set } from "@/lib/store";

type Tab = { id?: number; url?: string; title?: string; windowId?: number };
type View =
  | { k: "loading" }
  | { k: "signedOut" }
  | { k: "nothing" }
  | { k: "message"; text: string }
  | { k: "already"; item: Item; tab: Tab }
  | { k: "plucked"; item: Item; created: boolean; tips: boolean }
  | { k: "queued"; count: number };

const KINDS: Kind[] = ["link", "video", "pdf", "image", "todo", "note", "thing"];
const LINK_KINDS = new Set<Kind>(["link", "video", "pdf", "image"]);
const DAY_MONTH = { day: "numeric", month: "short" } as const;

// The tab to pluck: the active one, or ?tab=<id> (the e2e suite opens the popup as a page).
async function targetTab(): Promise<Tab | undefined> {
  const id = Number(new URLSearchParams(location.search).get("tab"));
  if (id) return browser.tabs.get(id);
  return (await browser.tabs.query({ active: true, currentWindow: true }))[0];
}

// Opening the popup plucks the page. A page already in the library opens on its item instead.
export function Popup() {
  const t = useTranslations("extension");
  const [view, setView] = useState<View>({ k: "loading" });

  const show = async (outcome: PluckOutcome) => {
    if (outcome.state === "queued") return setView({ k: "queued", count: outcome.count });
    if (outcome.state === "refused") return setView({ k: "message", text: outcome.message });
    const tips = !(await get("seenTips"));
    if (tips) await set({ seenTips: true });
    setView({ k: "plucked", item: outcome.item, created: outcome.created, tips });
  };

  useEffect(() => {
    (async () => {
      if (!(await get("tokens")) && !(await get("apiKey"))) return setView({ k: "signedOut" });
      const tab = await targetTab();
      if (!tab?.url || !/^https?:\/\//.test(tab.url)) return setView({ k: "nothing" });
      try {
        const { item } = await api<{ item: Item | null }>(`/api/v1/items/lookup?url=${encodeURIComponent(tab.url)}`);
        if (item) {
          if (tab.id !== undefined) await markTab(tab.id, true);
          return setView({ k: "already", item, tab });
        }
      } catch (e) {
        if (!(e instanceof Unreachable)) return setView({ k: "signedOut" });
      }
      await show(await pluckTab(tab));
    })().catch(() => setView({ k: "message", text: t("errors.tryAgain") }));
  }, []);

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
        <div className="card">
          <b className="title">{t("errors.nothing")}</b>
          <span className="meta">{t("popup.nothingHint")}</span>
        </div>
      );
    case "message":
      return (
        <div className="card">
          <b className="title">{view.text}</b>
        </div>
      );
    case "queued":
      return (
        <div className="card row">
          <span aria-hidden="true" className="queued-dot" />
          <div className="stack">
            <b>{t("popup.queued.title")}</b>
            <span className="meta">{t("popup.queued.count", { count: view.count })}</span>
          </div>
        </div>
      );
    case "already":
      return <Already item={view.item} again={async () => { setView({ k: "loading" }); await show(await pluckTab(view.tab)); }} />;
    case "plucked":
      return <Plucked initial={view.item} created={view.created} tips={view.tips} />;
  }
}

function Already({ item, again }: { item: Item; again: () => void }) {
  const t = useTranslations("extension");
  const format = useFormatter();
  const [tags, setTags] = useState<Tag[]>([]);
  useEffect(() => void api<{ tags: Tag[] }>("/api/v1/tags").then((r) => setTags(r.tags)).catch(() => {}), []);
  const names = item.tagIds.map((id) => tags.find((t) => t.id === id)?.name).filter(Boolean);
  return (
    <div className="card stack-14">
      <span className="meta">{t("popup.already.meta", { date: format.dateTime(new Date(item.createdAt), DAY_MONTH), status: t(`status.${item.status}`) })}</span>
      <b className="title">{item.title}</b>
      {names.length > 0 && <div className="row-6">{names.map((n) => <span key={n} className="chip-static">{n}</span>)}</div>}
      <div className="row-6">
        <button type="button" className="primary grow" onClick={() => openInPluck(`/items/${item.id}`)}>{t("popup.already.open")}</button>
        <button type="button" className="secondary grow" onClick={again}>{t("popup.already.again")}</button>
      </div>
    </div>
  );
}

function Plucked({ initial, created, tips }: { initial: Item; created: boolean; tips: boolean }) {
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

  useEffect(() => {
    api<{ tags: Tag[] }>("/api/v1/tags").then((r) => setTags(r.tags)).catch(() => {});
    api<{ lists: List[] }>("/api/v1/lists").then((r) => setLists(r.lists)).catch(() => {});
    get("lastListId").then(setLastListId);
    browser.tabs.query({ currentWindow: true }).then((t) => setTabCount(t.length));
  }, []);

  const patch = async (body: Record<string, unknown>) => setItem((await api<{ item: Item }>(`/api/v1/items/${item.id}`, { method: "PATCH", json: body })).item);
  const move = async (status: "later" | "archived") => {
    await patch({ status });
    window.close();
  };
  const toggleTag = (id: string) => patch({ tagIds: item.tagIds.includes(id) ? item.tagIds.filter((t) => t !== id) : [...item.tagIds, id] });
  const shownTags = [
    ...tags.filter((t) => item.tagIds.includes(t.id)),
    ...tags.filter((t) => !item.tagIds.includes(t.id) && t.name.toLowerCase().includes(filter.trim().toLowerCase())),
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
    <div className="popup">
      <div className="head">
        <span className="tick" aria-hidden="true">
          <svg width="16" height="16" viewBox="0 0 16 16"><path d="M3.5 8.5l3 3 6-7" fill="none" stroke="#151A13" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </span>
        <div className="head-text">
          <b role="status">{t("popup.plucked.title")}</b>
          {!tips && <span className="meta ellipsis">{item.title}</span>}
        </div>
        {created && !tips && (
          <button type="button" className="small" onClick={async () => {
            await api(`/api/v1/items/${item.id}`, { method: "DELETE" });
            const tab = await targetTab();
            if (tab?.id !== undefined) await markTab(tab.id, false);
            window.close();
          }}>{t("popup.plucked.undo")}</button>
        )}
      </div>
      {tips ? (
        <div className="tips">
          <span>{t("popup.plucked.tips.opening")}</span>
          <span>{t("popup.plucked.tips.shortcut")}</span>
          <span>{t("popup.plucked.tips.rightClick")}</span>
        </div>
      ) : (
        <>
          <div className="body">
            <label className="field">
              <span className="label">{t("popup.plucked.tags")}</span>
              <input type="text" placeholder={t("popup.plucked.tagsPlaceholder")} value={filter} onChange={(e) => setFilter(e.target.value)} />
            </label>
            {shownTags.length > 0 && (
              <div className="chips">
                {shownTags.map((t) => (
                  <button key={t.id} type="button" className="chip" aria-pressed={item.tagIds.includes(t.id)} onClick={() => void toggleTag(t.id)}>{t.name}</button>
                ))}
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
              <button type="button" className="secondary grow" onClick={() => void move("later")}>{t("popup.plucked.later")}</button>
              <button type="button" className="secondary grow" onClick={() => void move("archived")}>{t("popup.plucked.archive")}</button>
              <button type="button" className="primary grow-more" onClick={() => openInPluck(`/items/${item.id}`)}>{t("popup.plucked.open")}</button>
            </div>
          </div>
          <button type="button" className="footer" disabled={footer !== null || tabCount < 2} onClick={() => void pluckAllTabs()}>
            {footer ?? t("popup.tabs.all", { count: tabCount, name: listName })}
          </button>
        </>
      )}
    </div>
  );
}
