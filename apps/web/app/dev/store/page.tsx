import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isLocale, LOCALES, type Locale } from "@pluck/i18n";
import { length, LIMITS, load, loadAll, type Store } from "./data";
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
      {view === "all" ? <All stores={loadAll()} device={device} href={href} /> : <Page store={load(lang)} device={device} />}
    </div>
  );
}

const src = (path: string) => `/dev/store/file/${path}`;

function Page({ store, device }: { store: Store; device: Device }) {
  const shots = device === "ipad" ? store.ipad : store.iphone;
  const { listing } = store;
  return (
    <main className={s.main}>
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
          {shots.map((p) => <img key={p} src={src(p)} alt={p} title={p} loading="lazy" />)}
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
        return (
          <section key={store.locale} className={s.row} lang={store.locale}>
            <div className={s.rowText}>
              <a href={href({ view: "page", lang: store.locale })}><b>{store.label}</b> ({store.locale})</a>
              <strong>{store.listing.name}</strong>
              <span>{store.listing.subtitle}</span>
              <small>{store.listing.promotionalText}</small>
              <small className={store.flags.length ? s.warn : s.ok}>{store.flags.length ? `${store.flags.length} voice flag${store.flags.length > 1 ? "s" : ""}` : "Voice clear"}</small>
            </div>
            <div className={device === "ipad" ? s.rowShotsWide : s.rowShots}>
              {shots.map((p) => <img key={p} src={src(p)} alt={p} title={p} loading="lazy" />)}
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
