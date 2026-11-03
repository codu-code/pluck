import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isLocale, LOCALES, type Locale } from "@pluck/i18n";
import { issues, length, LIMITS, load, loadAll, type Issue, type Store } from "./data";
import s from "./store.module.css";

export const metadata: Metadata = { title: "Store preview", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

type Device = "iphone" | "ipad";
type Params = { lang?: string; device?: string; theme?: string; view?: string };

// A dev-only preview of the App Store listing, in every language, as App Store Connect has it (docs/store): the
// product page, the search result, the screenshots at their real proportions, and a check panel with Apple's limits
// and voice.md's rules. `pnpm --filter @pluck/web dev`, then /dev/store. Production answers 404.
export default async function StorePreview({ searchParams }: { searchParams: Promise<Params> }) {
  if (process.env.NODE_ENV === "production") notFound();
  const q = await searchParams;
  const lang: Locale = isLocale(q.lang) ? q.lang : "en";
  const device: Device = q.device === "ipad" ? "ipad" : "iphone";
  const theme = q.theme === "dark" ? "dark" : "light";
  const view = q.view === "all" ? "all" : "page";
  const href = (p: Params) => `?${new URLSearchParams({ lang, device, theme, view, ...p } as Record<string, string>)}`;

  return (
    <div className={s.root} data-theme={theme}>
      <header className={s.bar}>
        <strong>Store preview</strong>
        <nav className={s.pills}>
          <a href={href({ view: "page" })} aria-current={view === "page"}>Product page</a>
          <a href={href({ view: "all" })} aria-current={view === "all"}>All languages</a>
        </nav>
        <nav className={s.pills}>
          <a href={href({ device: "iphone" })} aria-current={device === "iphone"}>iPhone</a>
          <a href={href({ device: "ipad" })} aria-current={device === "ipad"}>iPad</a>
        </nav>
        <nav className={s.pills}>
          <a href={href({ theme: "light" })} aria-current={theme === "light"}>Light</a>
          <a href={href({ theme: "dark" })} aria-current={theme === "dark"}>Dark</a>
        </nav>
        {view === "page" && (
          <nav className={s.pills}>
            {LOCALES.map((l) => <a key={l} href={href({ lang: l })} aria-current={l === lang}>{l}</a>)}
          </nav>
        )}
      </header>
      {view === "all" ? <All stores={loadAll()} device={device} href={href} /> : <Page store={load(lang)} device={device} english={load("en")} />}
    </div>
  );
}

const src = (path: string) => `/dev/store/file/${path}`;
const frame = (path: string) => parseInt(path.split("/").pop() ?? "0");

// What's still to do on this page, before anything else: the known issues (docs/store/audit.json) and what the
// checks found. Review-level ones first.
function Warnings({ list, device, locale }: { list: Issue[]; device: Device; locale: string }) {
  if (!list.length) return <p className={s.clear}>Nothing left to do for {locale} on {device === "ipad" ? "iPad" : "iPhone"}.</p>;
  const sorted = [...list].sort((a, b) => (a.level === b.level ? 0 : a.level === "review" ? -1 : 1));
  return (
    <section className={s.warnings} role="alert">
      <h2>Still to do · {locale} · {device === "ipad" ? "iPad" : "iPhone"}</h2>
      <ul>
        {sorted.map((i) => (
          <li key={i.title} data-level={i.level}>
            <b>{i.level === "review" ? "App Review risk" : "Polish"}{i.frames.length ? ` · frame${i.frames.length > 1 ? "s" : ""} ${i.frames.join(", ")}` : ""}:</b> {i.title}.
            <span> {i.detail}</span>
            <em> To do: {i.todo}</em>
          </li>
        ))}
      </ul>
    </section>
  );
}

// A screenshot, marked when an issue covers its frame.
function Shot({ path, list }: { path: string; list: Issue[] }) {
  const mine = list.filter((i) => i.frames.includes(frame(path)));
  const worst = mine.find((i) => i.level === "review") ?? mine[0];
  return (
    <figure className={s.shot} data-level={worst?.level}>
      <img src={src(path)} alt={path} title={path} loading="lazy" />
      {worst && <figcaption>{worst.level === "review" ? "App Review risk" : "Polish"}: {worst.title}</figcaption>}
    </figure>
  );
}

function Page({ store, device, english }: { store: Store; device: Device; english: Store }) {
  const shots = device === "ipad" ? store.ipad : store.iphone;
  const { listing } = store;
  const list = issues(store, device, english);
  return (
    <main className={s.main}>
      <Warnings list={list} device={device} locale={store.label} />
      <div className={device === "ipad" ? s.storeWide : s.store} lang={store.locale}>
        <section className={s.head}>
          <img className={s.icon} src="/icon-512.png" alt="" />
          <div className={s.titles}>
            <h1 className={s.name}>{listing.name}</h1>
            <p className={s.subtitle}>{listing.subtitle}</p>
            <span className={s.get}>Get</span>
          </div>
        </section>
        <dl className={s.strip}>
          <div><dt>Ratings</dt><dd>None yet</dd></div>
          <div><dt>Age</dt><dd>4+</dd></div>
          <div><dt>Category</dt><dd>Productivity</dd></div>
          <div><dt>Developer</dt><dd>Codú</dd></div>
          <div><dt>Languages</dt><dd>{store.locale.toUpperCase()} + 9 more</dd></div>
        </dl>
        <div className={device === "ipad" ? s.shotsWide : s.shots}>
          {shots.map((p) => <Shot key={p} path={p} list={list} />)}
          {shots.length === 0 && <p className={s.missing}>No {device === "ipad" ? "iPad" : "iPhone"} screenshots for {store.locale}.</p>}
        </div>
        <p className={s.promo}>{listing.promotionalText}</p>
        {/* The App Store shows three lines, then "more". */}
        <details className={s.description}>
          <summary><span className={s.clamp}>{listing.description}</span><span className={s.more}>more</span></summary>
          <p>{listing.description}</p>
        </details>
        <section className={s.search}>
          <h2>In search results</h2>
          <div className={s.result}>
            <img className={s.smallIcon} src="/icon-512.png" alt="" />
            <div className={s.titles}><strong>{listing.name}</strong><span>{listing.subtitle}</span></div>
            <span className={s.get}>Get</span>
          </div>
          <div className={s.resultShots}>
            {shots.slice(0, device === "ipad" ? 2 : 3).map((p) => <img key={p} src={src(p)} alt={p} />)}
          </div>
        </section>
        <section className={s.info}>
          <h2>Information</h2>
          <dl>
            <div><dt>Seller</dt><dd>Codú Limited</dd></div>
            <div><dt>Category</dt><dd>Productivity</dd></div>
            <div><dt>Compatibility</dt><dd>iPhone, iPad</dd></div>
            <div><dt>Languages</dt><dd>{LOCALES.join(", ")}</dd></div>
            <div><dt>Price</dt><dd>Free</dd></div>
            <div><dt>Copyright</dt><dd>© 2026 Codú Limited</dd></div>
          </dl>
        </section>
      </div>
      <Checks store={store} />
    </main>
  );
}

function Checks({ store }: { store: Store }) {
  const fields = Object.keys(LIMITS) as (keyof typeof LIMITS)[];
  return (
    <aside className={s.checks}>
      <h2>Checks · {store.label}</h2>
      <table>
        <tbody>
          {fields.map((f) => {
            const n = length(f, store.listing[f] ?? "");
            return <tr key={f} data-over={n > LIMITS[f]}><th>{f}</th><td>{n} / {LIMITS[f]}{f === "keywords" ? " bytes" : ""}</td></tr>;
          })}
          <tr><th>iPhone shots</th><td>{store.iphone.length}</td></tr>
          <tr><th>iPad shots</th><td>{store.ipad.length}</td></tr>
        </tbody>
      </table>
      <h3>Voice</h3>
      {store.flags.length === 0 ? <p className={s.ok}>Nothing voice.md rules out.</p> : (
        <ul className={s.flags}>{store.flags.map((f, i) => <li key={i}><b>{f.field}</b>: {f.rule}<q>{f.text}</q></li>)}</ul>
      )}
      <h3>Keywords</h3>
      <p className={s.keywords}>{store.listing.keywords.split(",").map((k) => <span key={k}>{k.trim()}</span>)}</p>
      {store.ipadCaptions.length > 0 && (
        <>
          <h3>iPad captions</h3>
          <ol className={s.captions}>{store.ipadCaptions.map((c, i) => <li key={i}><b>{c.title}</b> {c.subtitle}</li>)}</ol>
        </>
      )}
    </aside>
  );
}

function All({ stores, device, href }: { stores: Store[]; device: Device; href: (p: Params) => string }) {
  return (
    <main className={s.all}>
      {stores.map((store) => {
        const shots = device === "ipad" ? store.ipad : store.iphone;
        const list = issues(store, device, stores[0]!);
        return (
          <section key={store.locale} className={s.row} lang={store.locale}>
            <div className={s.rowText}>
              <a href={href({ view: "page", lang: store.locale })}><b>{store.label}</b> ({store.locale})</a>
              <strong>{store.listing.name}</strong>
              <span>{store.listing.subtitle}</span>
              <small>{store.listing.promotionalText}</small>
              <small className={store.flags.length ? s.warn : s.ok}>{store.flags.length ? `${store.flags.length} voice flag${store.flags.length > 1 ? "s" : ""}` : "Voice clear"}</small>
              {list.length > 0 && (
                <ul className={s.rowWarnings}>
                  {list.map((i) => <li key={i.title} data-level={i.level}><b>{i.level === "review" ? "Review risk" : "Polish"}:</b> {i.title}. <em>{i.todo}</em></li>)}
                </ul>
              )}
            </div>
            <div className={device === "ipad" ? s.rowShotsWide : s.rowShots}>
              {shots.map((p) => <Shot key={p} path={p} list={list} />)}
            </div>
          </section>
        );
      })}
      <section className={s.featuring}>
        <h2>Featuring art and promo</h2>
        <div>
          {["KeyArt", "Header", "Hero-16x9", "Wide-4x1", "Square", "Portrait-3x4", "AppOfTheDay"].map((n) => <figure key={n}><img src={src(`featuring/Featuring-${n}.png`)} alt={n} /><figcaption>{n}</figcaption></figure>)}
          {["pluck-promo-1080.mp4", "pluck-promo-9x16.mp4", "pluck-ipad-teaser-4x5.mp4"].map((n) => <figure key={n}><video src={src(`promo/${n}`)} controls muted loop playsInline /><figcaption>{n}</figcaption></figure>)}
        </div>
      </section>
    </main>
  );
}
