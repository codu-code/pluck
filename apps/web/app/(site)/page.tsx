import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import type { ReactNode } from "react";
import { APP_STORE_URL, CHROME_STORE_URL } from "@/lib/site";
import { PasteBox } from "./PasteBox";
import { Reveal } from "./Reveal";
import { SitePage } from "./SiteChrome";
import styles from "./site.module.css";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("site.home.meta");
  return { title: t("title"), description: t("description") };
}

// The app, drawn for the hero (the Landing board's rows).
const ROWS = [
  { key: "mcp", ini: "MC", tile: "var(--tile-0)", on: false },
  { key: "postgres", ini: "YT", tile: "var(--tile-1)", on: true },
  { key: "idea", ini: "", tile: "var(--rail)", on: false },
  { key: "hob", ini: "", tile: "var(--rail)", on: false },
] as const;
const KITCHEN = [
  { key: "hob", on: true },
  { key: "tap", on: true },
  { key: "led", on: false },
  { key: "extractor", on: true },
] as const;
const IMPORTS = [
  { name: "Pocket", fmt: "pocket" },
  { name: "Omnivore", fmt: "omnivore" },
  { name: "Raindrop", fmt: "raindrop" },
  { name: null, fmt: "browser" },
] as const;

const Tick = ({ size, stroke = "#151A13" }: { size: number; stroke?: string }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true">
    <path d="M3.5 8.5l3 3 6-7" fill="none" stroke={stroke} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export default async function Home() {
  const t = await getTranslations("site.home");
  const dot = (c: ReactNode) => <span className={styles.dot}>{c}</span>;
  return (
    <SitePage page="home">
      <Reveal />
      <section className={`${styles.wrap} ${styles.hero}`}>
        <h1 className={`${styles.display} ${styles.heroTitle}`}>{t.rich("hero.title", { dot })}</h1>
        <div className={styles.heroRow}>
          <p className={styles.heroLede}>
            <span className={styles.line}>{t("hero.line1")}</span> <span className={styles.line}>{t("hero.line2")}</span>{" "}
            <span className={styles.line}>{t("hero.line3")}</span>
          </p>
          <PasteBox />
        </div>
      </section>

      <section aria-label={t("mock.label")} className={`${styles.wrap} ${styles.appShot}`}>
        <div className={styles.mock} aria-hidden="true">
          <div className={styles.mockHead}>
            <b>{t("mock.inbox")}</b>
            <span className={styles.quiet} style={{ fontSize: 14 }}>{t("mock.toTriage", { count: 24 })}</span>
            <span className={`${styles.mockKeys} ${styles.mono}`}>j k l e t a</span>
          </div>
          {ROWS.map((r) => (
            <div key={r.key} className={`${styles.mockRow} ${r.on ? styles.mockRowOn : ""}`}>
              <div className={styles.mockTile} style={{ background: r.tile }}>{r.ini}</div>
              <div className={styles.mockText}><b>{t(`mock.rows.${r.key}.title`)}</b><span>{t(`mock.rows.${r.key}.meta`)}</span></div>
              <span className={styles.mockTag}>{t(`mock.rows.${r.key}.tag`)}</span>
            </div>
          ))}
        </div>
        <div role="presentation" className={styles.stamp}>
          <span className={styles.stampTick}><Tick size={20} /></span>
          <b>{t("mock.plucked")}</b>
        </div>
      </section>

      <section className={styles.band} data-reveal>
        <div className={styles.bandInner}>
          <p className={styles.bandBig}>
            {/* Set as four lines on wide screens; on a phone it flows, but each thing stays in one piece. */}
            <span className={styles.bandLine}>
              <span className={styles.phrase}>{t("band.article")}</span> <span className={styles.phrase}>{t("band.recipe")}</span> <span className={styles.phrase}>{t("band.thread")}</span>
            </span>{" "}
            <span className={styles.bandLine}>
              <span className={`${styles.phrase} ${styles.mint}`}>{t("band.idea")}</span> <span className={styles.phrase}>{t("band.hob")}</span>
            </span>{" "}
            <span className={styles.bandLine}><span className={styles.phraseLong}>{t("band.talk")}</span></span>{" "}
            <span className={styles.bandLine}><span className={`${styles.phraseLong} ${styles.unread}`}>{t("band.pdf")}</span></span>
          </p>
          <p className={styles.bandSmall}>{t("band.small")}</p>
        </div>
      </section>

      <section className={`${styles.wrap} ${styles.stats}`}>
        <div className={styles.stat}>
          <b className={`${styles.display} ${styles.statNumber}`}>{t("stats.tapNumber")}</b>
          <p className={styles.statText}>{t("stats.tap")}</p>
        </div>
        <div className={styles.stat}>
          <b className={`${styles.display} ${styles.statNumber}`}>{t("stats.nagsNumber")}</b>
          <p className={styles.statText}>{t("stats.nags")}</p>
        </div>
        <div className={styles.stat}>
          <b className={`${styles.display} ${styles.statNumber}`}>{t("stats.secondsNumber")}</b>
          <p className={styles.statText}>{t("stats.seconds")}</p>
        </div>
      </section>

      <section id="lists" className={`${styles.wrap} ${styles.listsSection}`}>
        <div className={styles.listsCopy}>
          <h2 className={`${styles.display} ${styles.h2Big}`}>{t("lists.title")}</h2>
          <p className={styles.para}>{t.rich("lists.para1", { phrase: (c) => <span className={styles.phrase}>{c}</span> })}</p>
          <p className={styles.para}>{t("lists.para2")}</p>
        </div>
        <div className={styles.listArt} data-reveal>
          <div className={styles.listCard}>
            <div className={styles.listCardHead}><b>{t("lists.cardTitle")}</b><span>{t("lists.progress", { done: 3, total: 7 })}</span></div>
            {KITCHEN.map((k) => (
              <div key={k.key} className={styles.entry}>
                <span className={`${styles.ring} ${k.on ? styles.ringOn : ""}`}>{k.on && <Tick size={12} />}</span>
                <span className={styles.entryText}><b>{t(`lists.kitchen.${k.key}.title`)}</b><span>{t(`lists.kitchen.${k.key}.note`)}</span></span>
              </div>
            ))}
          </div>
          <div className={styles.publicChip}>
            <svg width="18" height="18" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 14A6 6 0 1 0 8 2a6 6 0 0 0 0 12zM2 8h12M8 2c1.8 1.7 2.6 3.8 2.6 6S9.8 12.3 8 14C6.2 12.3 5.4 10.2 5.4 8S6.2 3.7 8 2z" fill="none" stroke="#151A13" strokeWidth="1.5" /></svg>
            <span style={{ display: "flex", flexDirection: "column" }}>
              <b>getpluck.io/@niall/best-mcp-reading</b>
              <span>{t("lists.public")}</span>
            </span>
          </div>
        </div>
      </section>

      <section className={`${styles.wrap} ${styles.aiSection}`}>
        <div className={styles.aiCard}>
          <div className={styles.aiCopy}>
            <span className={`${styles.eyebrow} ${styles.mono}`}>{t("ai.eyebrow")}</span>
            <h2 className={`${styles.display} ${styles.h2Mid}`}>{t("ai.title")}</h2>
            <p className={styles.aiPara}>
              <span className={styles.line}>{t("ai.ask1")}</span> <span className={styles.line}>{t("ai.ask2")}</span>{" "}
              <span className={styles.line}>{t("ai.ask3")}</span>{" "}
              <span className={styles.lineGap}>{t("ai.body")}</span>
            </p>
            <Link href="/connect" className={styles.lightButton}>{t("ai.button")}</Link>
          </div>
          <div className={styles.chat} data-reveal>
            <div className={styles.me}>{t("ai.chatMe1")}</div>
            <span className={`${styles.toolCall} ${styles.mono}`}>save_item kind=note</span>
            <div className={styles.ai}>{t("ai.chatAi1")}</div>
            <div className={styles.me}>{t("ai.chatMe2")}</div>
            <div className={styles.ai}>{t("ai.chatAi2")}</div>
          </div>
        </div>
      </section>

      <section className={`${styles.wrap} ${styles.importsSection}`}>
        <div className={styles.col}>
          <h2 className={`${styles.display} ${styles.h2Small}`}>{t("imports.title")}</h2>
          <p className={styles.para} style={{ maxWidth: "none" }}>{t("imports.body")}</p>
        </div>
        <div className={styles.importList}>
          {IMPORTS.map((i) => <div key={i.fmt} className={styles.importRow}><b>{i.name ?? t("imports.anyBrowser")}</b><span>{t(`imports.${i.fmt}`)}</span></div>)}
          <Link href="/open-source" className={styles.textLink}>{t("imports.selfHost")}</Link>
        </div>
      </section>

      <section className={`${styles.wrap} ${styles.closing}`}>
        <p className={`${styles.display} ${styles.closingBig}`}>{t.rich("closing.title", { br: () => <br />, dot })}</p>
        <div className={styles.buttons}>
          <a href={CHROME_STORE_URL} className={`${styles.big} ${styles.bigPrimary}`}>{t("closing.chrome")}</a>
          <a href={APP_STORE_URL} className={`${styles.big} ${styles.bigOutline}`}>{t("closing.iphone")}</a>
          <Link href="/signin" className={`${styles.big} ${styles.bigOutline}`}>{t("closing.web")}</Link>
        </div>
      </section>
    </SitePage>
  );
}
