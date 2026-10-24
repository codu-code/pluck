import type { Metadata } from "next";
import Link from "next/link";
import { CONNECTOR_URL } from "@/lib/site";
import { SitePage } from "../SiteChrome";
import styles from "../site.module.css";
import { ConnectTabs } from "./ConnectTabs";

// The connector URL is this server's own, so a self-hosted copy shows its address, not the one it was built with.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Connect your AI · Pluck",
  description: "Pluck speaks MCP. One link and the AI tool you already use can read, search and sort your library.",
};

const TOOLS = [
  { key: "claude", label: "Claude", steps: ["Open Claude, then Settings, then Connectors.", "Choose Add custom connector and paste the link.", "Sign in to Pluck when it asks. Done."], codeLabel: "Connector URL", code: CONNECTOR_URL, note: "Works on web, desktop and phone once added." },
  { key: "code", label: "Claude Code", steps: ["Open a terminal.", "Run the one line on the right.", "Say “what did I pluck this week?” to test it."], codeLabel: "One line", code: `claude mcp add --transport http pluck ${CONNECTOR_URL}`, note: "Signs you in through your browser the first time." },
  { key: "chatgpt", label: "ChatGPT", steps: ["Open ChatGPT, then Settings, then Connectors.", "Choose Create and paste the link as the MCP server URL.", "Sign in to Pluck when it asks."], codeLabel: "MCP server URL", code: CONNECTOR_URL, note: "Needs a plan that allows custom connectors." },
  { key: "cursor", label: "Cursor", steps: ["Open Cursor settings, then MCP.", "Add a server with the JSON on the right.", "Sign in to Pluck when it asks."], codeLabel: "mcp.json", code: `{ "mcpServers": { "pluck": { "url": "${CONNECTOR_URL}" } } }`, note: "Any editor or client that supports remote MCP works the same way." },
  { key: "self", label: "Self-hosted", steps: ["Make an API key in Settings.", "Add the line on the right to your AI tool as a local (stdio) server.", "Ask it what you plucked this week."], codeLabel: "Without a public URL", code: "npx @pluck/mcp --server https://pluck.your.host --key pk_live_…", note: "The same tools and prompts, bridged to your own server." },
];

const TOOL_LIST = [
  { name: "search_items", does: "Text search over title, note, tags, list names and body." },
  { name: "list_items", does: "Browse Inbox, Later, Archive or Done, newest or untouched first." },
  { name: "get_item", does: "One item in full, including the stored page text." },
  { name: "save_item", does: "Pluck a link, many links, a note, a todo or a thing. Marked as plucked by AI." },
  { name: "batch_update", does: "Status, kind, tags and due dates on one or many items." },
  { name: "list_tags", does: "Your tags, with counts." },
  { name: "create_tag", does: "A new tag, only after you said yes." },
  { name: "list_lists", does: "Your lists, with purpose, count and visibility." },
  { name: "get_list", does: "One list in order, with notes and ticks." },
  { name: "create_list", does: "A new list with items in order and a note per item. Private." },
  { name: "update_list", does: "Rename, reorder, add, tick, or make public when you say so." },
  { name: "get_digest", does: "Expiring, due, oldest and quiet lists. The Monday email, as data." },
];

const ASKS = [
  { say: "Tidy my Pluck inbox.", does: "Proposes tags from the ones you already have, plus keep, later or archive per item. You say yes or edit. One batch." },
  { say: "Make a reading list on MCP auth, best first.", does: "Searches, reads, and builds the list in order with a line on why each one matters. Private until you say otherwise." },
  { say: "Three blog ideas from what I plucked this week.", does: "Reads the best five in full and drafts three angles with sources. Pick one and it plucks the draft back in as a Note." },
  { say: "Run my weekly review.", does: "The Monday email, in conversation. One decision at a time." },
];

const NEVER = [
  "Delete anything. The scope isn't granted.",
  "Make a tag you didn't ask for.",
  "Rename or remove a tag you made.",
  "Rewrite a list's purpose.",
  "Make a list public without you saying so.",
];

export default function Connect() {
  return (
    <SitePage page="connect" dark footerNote="Pluck is free and open source.">
      <section className={`${styles.wrap} ${styles.pageHero}`}>
        <span className={`${styles.eyebrow} ${styles.mono}`}>PLUCK + YOUR AI · MCP</span>
        <h1 className={`${styles.display} ${styles.connectTitle}`}>Ready for your AI. Whichever one you use.</h1>
        <p className={`${styles.heroPara} ${styles.heroQuiet}`}>
          Pluck speaks MCP, the open standard AI tools use to plug into apps. One link and your AI can read, search and sort your whole library. It changes things only when you say so, and never deletes.
        </p>
      </section>

      <section className={`${styles.wrap} ${styles.block}`}>
        <h2 className={`${styles.display} ${styles.h2Section}`}>Install. Thirty seconds, honestly.</h2>
        <p className={styles.sub}>Sign in to Pluck, then pick your tool. The link is the same for all of them.</p>
        <ConnectTabs tools={TOOLS} />
      </section>

      <section className={`${styles.wrap} ${styles.twoCols}`}>
        <div className={styles.col}>
          <h2 className={`${styles.display} ${styles.h2Section}`}>Twelve tools. Plain names.</h2>
          <p className={styles.colPara}>Results come back as cards with titles first, so a question like “what did I pluck this week” is one call and one screen.</p>
          <div className={styles.ruled}>
            {TOOL_LIST.map((t) => (
              <div key={t.name} className={styles.toolRow}><code className={`${styles.toolName} ${styles.mono}`}>{t.name}</code><span className={styles.toolDoes}>{t.does}</span></div>
            ))}
          </div>
        </div>
        <div className={styles.col}>
          <h2 className={`${styles.display} ${styles.h2Section}`}>Four things to ask.</h2>
          <div className={styles.ruled}>
            {ASKS.map((a) => <div key={a.say} className={styles.askRow}><b>“{a.say}”</b><span>{a.does}</span></div>)}
          </div>
          <div className={styles.never}>
            <b>What your AI can never do</b>
            {NEVER.map((n) => <span key={n} className={styles.neverItem}><span aria-hidden="true" className={styles.dash} />{n}</span>)}
            <span className={styles.neverNote}>Everything it adds carries a “by AI” mark. Settings removes a week of it in one tap.</span>
          </div>
        </div>
      </section>

      <section className={`${styles.wrap} ${styles.closingRow}`}>
        <p className={`${styles.display} ${styles.closingMid}`}>Ask your AI<span className={styles.mint}>.</span></p>
        <Link href="/signin" className={`${styles.big} ${styles.bigLight}`}>Get Pluck, then connect</Link>
      </section>
    </SitePage>
  );
}
