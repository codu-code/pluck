import type { Metadata } from "next";
import Link from "next/link";
import { APP_STORE_URL, CHROME_STORE_URL } from "@/lib/site";
import { PasteBox } from "./PasteBox";
import { SitePage } from "./SiteChrome";
import styles from "./site.module.css";

export const metadata: Metadata = {
  title: "Pluck · Pluck it. Sort it later.",
  description: "Pluck anything in one tap. Sort it later, by hand or with your AI. Free and open source.",
};

// The app, drawn for the hero (the Landing board's rows).
const ROWS = [
  { t: "How MCP auth actually works", s: "modelcontextprotocol.io · 12 min", tag: "mcp", ini: "MC", tile: "var(--tile-0)", on: false },
  { t: "Postgres indexes in 40 minutes", s: "youtube.com · 41 min", tag: "postgres", ini: "YT", tile: "var(--tile-1)", on: true },
  { t: "An MCP server for Assemble's estimates", s: "Note · by you", tag: "assemble", ini: "", tile: "var(--rail)", on: false },
  { t: "Induction hob, 60 cm, four zones", s: "Thing · Kitchen reno list", tag: "kitchen", ini: "", tile: "var(--rail)", on: false },
];
const KITCHEN = [
  { t: "Induction hob, 60 cm", n: "Check the width against the cut-out.", on: true },
  { t: "Tap with a pull-out spray", n: "Brushed steel, not chrome.", on: true },
  { t: "Under-cabinet LED strip", n: "Plug-in, no electrician.", on: false },
  { t: "Extractor, ducted", n: "Ask the fitters about the wall first.", on: true },
];
const IMPORTS = [
  { name: "Pocket", fmt: "CSV export" },
  { name: "Omnivore", fmt: "Export zip" },
  { name: "Raindrop", fmt: "CSV" },
  { name: "Any browser", fmt: "Bookmarks HTML" },
];

const Tick = ({ size, stroke = "#151A13" }: { size: number; stroke?: string }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true">
    <path d="M3.5 8.5l3 3 6-7" fill="none" stroke={stroke} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export default function Home() {
  return (
    <SitePage page="home">
      <section className={`${styles.wrap} ${styles.hero}`}>
        <h1 className={`${styles.display} ${styles.heroTitle}`}>Pluck it<span className={styles.dot}>.</span></h1>
        <div className={styles.heroRow}>
          <p className={styles.heroLede}>
            <span className={styles.line}>Pluck anything in one tap.</span> <span className={styles.line}>Sort it later, by hand or with your AI.</span>{" "}
            <span className={styles.line}>Or don't. We won't nag.</span>
          </p>
          <PasteBox />
        </div>
      </section>

      <section aria-label="The app" className={`${styles.wrap} ${styles.appShot}`}>
        <div className={styles.mock} aria-hidden="true">
          <div className={styles.mockHead}>
            <b>Inbox</b>
            <span className={styles.quiet} style={{ fontSize: 14 }}>24 to triage</span>
            <span className={`${styles.mockKeys} ${styles.mono}`}>j k l e t a</span>
          </div>
          {ROWS.map((r) => (
            <div key={r.t} className={`${styles.mockRow} ${r.on ? styles.mockRowOn : ""}`}>
              <div className={styles.mockTile} style={{ background: r.tile }}>{r.ini}</div>
              <div className={styles.mockText}><b>{r.t}</b><span>{r.s}</span></div>
              <span className={styles.mockTag}>{r.tag}</span>
            </div>
          ))}
        </div>
        <div role="presentation" className={styles.stamp}>
          <span className={styles.stampTick}><Tick size={20} /></span>
          <b>Plucked.</b>
        </div>
      </section>

      <section className={styles.band}>
        <div className={styles.bandInner}>
          <p className={styles.bandBig}>
            {/* Set as four lines on wide screens; on a phone it flows, but each thing stays in one piece. */}
            <span className={styles.bandLine}>
              <span className={styles.phrase}>An article.</span> <span className={styles.phrase}>A recipe.</span> <span className={styles.phrase}>A thread.</span>
            </span>{" "}
            <span className={styles.bandLine}>
              <span className={`${styles.phrase} ${styles.mint}`}>Half an idea.</span> <span className={styles.phrase}>A hob for the kitchen.</span>
            </span>{" "}
            <span className={styles.bandLine}><span className={styles.phrase}>A talk you'll give in November.</span></span>{" "}
            <span className={styles.bandLine}><span className={`${styles.phrase} ${styles.quiet}`}>A PDF you will never read.</span></span>
          </p>
          <p className={styles.bandSmall}>One inbox for all of it. The page is kept, not just the link, so it's still there when the site isn't.</p>
        </div>
      </section>

      <section className={`${styles.wrap} ${styles.stats}`}>
        <div className={styles.stat}>
          <b className={`${styles.display} ${styles.statNumber}`}>1 tap</b>
          <p className={styles.statText}>From the iPhone share sheet, without opening an app. From Chrome, Firefox, your email, or a chat with your AI. “Plucked” in under 300 ms. Every time.</p>
        </div>
        <div className={styles.stat}>
          <b className={`${styles.display} ${styles.statNumber}`}>0 nags</b>
          <p className={styles.statText}>No streaks, no badges, no guilt. Nothing gets tagged behind your back. Things you never touch move to the Archive after 30 days (you pick the number), unless they're in a list. Nothing is deleted.</p>
        </div>
        <div className={styles.stat}>
          <b className={`${styles.display} ${styles.statNumber}`}>30 s</b>
          <p className={styles.statText}>To plug in the AI you already use. Claude, ChatGPT, Cursor, anything that speaks MCP. Ask it to tidy, group or turn your plucks into ideas. It works while you watch, and never deletes.</p>
        </div>
      </section>

      <section id="lists" className={`${styles.wrap} ${styles.listsSection}`}>
        <div className={styles.listsCopy}>
          <h2 className={`${styles.display} ${styles.h2Big}`}>Lists are what you're making.</h2>
          <p className={styles.para}>A book. A newsletter issue. A talk. A trip. <span className={styles.phrase}>Things to buy.</span> Put any pluck in as many lists as you like, each with its own note and a tick.</p>
          <p className={styles.para}>Private by default. Public with one switch. Take it back with the same switch.</p>
        </div>
        <div className={styles.listArt}>
          <div className={styles.listCard}>
            <div className={styles.listCardHead}><b>Kitchen reno, to buy</b><span>3 of 7</span></div>
            {KITCHEN.map((k) => (
              <div key={k.t} className={styles.entry}>
                <span className={`${styles.ring} ${k.on ? styles.ringOn : ""}`}>{k.on && <Tick size={12} />}</span>
                <span className={styles.entryText}><b>{k.t}</b><span>{k.n}</span></span>
              </div>
            ))}
          </div>
          <div className={styles.publicChip}>
            <svg width="18" height="18" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 14A6 6 0 1 0 8 2a6 6 0 0 0 0 12zM2 8h12M8 2c1.8 1.7 2.6 3.8 2.6 6S9.8 12.3 8 14C6.2 12.3 5.4 10.2 5.4 8S6.2 3.7 8 2z" fill="none" stroke="#151A13" strokeWidth="1.5" /></svg>
            <span style={{ display: "flex", flexDirection: "column" }}>
              <b>getpluck.io/@niall/best-mcp-reading</b>
              <span>Public. Anyone can pluck it into theirs.</span>
            </span>
          </div>
        </div>
      </section>

      <section className={`${styles.wrap} ${styles.aiSection}`}>
        <div className={styles.aiCard}>
          <div className={styles.aiCopy}>
            <span className={`${styles.eyebrow} ${styles.mono}`}>READY FOR YOUR AI</span>
            <h2 className={`${styles.display} ${styles.h2Mid}`}>Plug in the AI you already use.</h2>
            <p className={styles.aiPara}>
              <span className={styles.line}>“What did I pluck about MCP auth?”</span> <span className={styles.line}>“Tidy my inbox.”</span>{" "}
              <span className={styles.line}>“Make a reading list from this month, best first.”</span>{" "}
              <span className={styles.lineGap}>One link and your whole library is there. It changes things only when you say so, and marks everything it touched.</span>
            </p>
            <Link href="/connect" className={styles.lightButton}>How it works with AI</Link>
          </div>
          <div className={styles.chat}>
            <div className={styles.me}>Pluck this as an idea: an MCP server for Assemble's estimates</div>
            <span className={`${styles.toolCall} ${styles.mono}`}>save_item kind=note</span>
            <div className={styles.ai}>Plucked. It's in your inbox as a Note, marked as plucked by me.</div>
            <div className={styles.me}>What's rotting in my library?</div>
            <div className={styles.ai}>Five things untouched for a month. Want to go through them one at a time?</div>
          </div>
        </div>
      </section>

      <section className={`${styles.wrap} ${styles.importsSection}`}>
        <div className={styles.col} style={{ gap: 16 }}>
          <h2 className={`${styles.display} ${styles.h2Small}`}>Pocket shut down. Omnivore shut down.</h2>
          <p className={styles.para} style={{ maxWidth: "none" }}>Pluck is open source and runs on a database you can own. It can't close with two weeks' notice. Bring your old library across in one go.</p>
        </div>
        <div className={styles.importList}>
          {IMPORTS.map((i) => <div key={i.name} className={styles.importRow}><b>{i.name}</b><span>{i.fmt}</span></div>)}
          <Link href="/open-source" className={styles.textLink}>Self-host it in one command</Link>
        </div>
      </section>

      <section className={`${styles.wrap} ${styles.closing}`}>
        <p className={`${styles.display} ${styles.closingBig}`}>Sort it<br />later<span className={styles.dot}>.</span></p>
        <div className={styles.buttons}>
          <a href={CHROME_STORE_URL} className={`${styles.big} ${styles.bigPrimary}`}>Add to Chrome</a>
          <a href={APP_STORE_URL} className={`${styles.big} ${styles.bigOutline}`}>iPhone</a>
          <Link href="/signin" className={`${styles.big} ${styles.bigOutline}`}>Use it on the web</Link>
        </div>
      </section>
    </SitePage>
  );
}
