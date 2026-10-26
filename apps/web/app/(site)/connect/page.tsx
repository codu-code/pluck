import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import Link from "@/components/SiteLink";
import { ConnectLoop } from "@/components/ConnectLoop";
import { ConnectLoopFit } from "@/components/ConnectLoopFit";
import { CONNECTOR_URL, pageMeta } from "@/lib/site";
import { SitePage } from "../SiteChrome";
import styles from "../site.module.css";
import { ConnectTabs } from "./ConnectTabs";

// The connector URL is this server's own, so a self-hosted copy shows its address, not the one it was built with.
export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("site.connect.meta");
  return { title: t("title"), description: t("description"), ...(await pageMeta("/connect")) };
}

// Product names stay as they are; the steps and notes are under site.connect.tools.<key>.
const TOOLS = [
  { key: "claude", label: "Claude", code: CONNECTOR_URL },
  { key: "code", label: "Claude Code", code: `claude mcp add --transport http pluck ${CONNECTOR_URL}` },
  { key: "chatgpt", label: "ChatGPT", code: CONNECTOR_URL },
  { key: "cursor", label: "Cursor", codeLabel: "mcp.json", code: `{ "mcpServers": { "pluck": { "url": "${CONNECTOR_URL}" } } }` },
  { key: "self", code: "npx @pluck/mcp --server https://pluck.your.host --key pk_live_…" },
] as const;

const TOOL_LIST = ["search_items", "list_items", "get_item", "save_item", "batch_update", "list_tags", "create_tag", "list_lists", "get_list", "create_list", "update_list", "get_digest"] as const;
const ASKS = ["tidy", "reading", "ideas", "review"] as const;
const NEVER = ["delete", "makeTag", "renameTag", "purpose", "public"] as const;

export default async function Connect() {
  const t = await getTranslations("site.connect");
  const tc = await getTranslations("site.chrome");
  const tools = TOOLS.map((x) => ({
    key: x.key,
    label: "label" in x ? x.label : t("tools.self.label"),
    steps: [t(`tools.${x.key}.step1`), t(`tools.${x.key}.step2`), t(`tools.${x.key}.step3`)],
    codeLabel: "codeLabel" in x ? x.codeLabel : t(`tools.${x.key}.codeLabel`),
    code: x.code,
    note: t(`tools.${x.key}.note`),
  }));
  return (
    <SitePage page="connect" dark footerNote={tc("freeAndOpen")}>
      <section className={`${styles.wrap} ${styles.pageHero}`}>
        <span className={`${styles.eyebrow} ${styles.mono}`}>{t("eyebrow")}</span>
        <h1 className={`${styles.display} ${styles.connectTitle}`}>{t("title")}</h1>
        <p className={`${styles.heroPara} ${styles.heroQuiet}`}>{t("lede")}</p>
      </section>

      <section aria-label={t("loopLabel")} className={`${styles.wrap} ${styles.block}`}>
        <ConnectLoopFit radius={16}><ConnectLoop /></ConnectLoopFit>
      </section>

      <section className={`${styles.wrap} ${styles.block}`}>
        <h2 className={`${styles.display} ${styles.h2Section}`}>{t("installTitle")}</h2>
        <p className={styles.sub}>{t("installSub")}</p>
        <ConnectTabs tools={tools} />
      </section>

      <section className={`${styles.wrap} ${styles.twoCols}`}>
        <div className={styles.col}>
          <h2 className={`${styles.display} ${styles.h2Section}`}>{t("toolsTitle")}</h2>
          <p className={styles.colPara}>{t("toolsBody")}</p>
          <div className={styles.ruled}>
            {TOOL_LIST.map((name) => (
              <div key={name} className={styles.toolRow}><code className={`${styles.toolName} ${styles.mono}`}>{name}</code><span className={styles.toolDoes}>{t(`toolList.${name}`)}</span></div>
            ))}
          </div>
        </div>
        <div className={styles.col}>
          <h2 className={`${styles.display} ${styles.h2Section}`}>{t("asksTitle")}</h2>
          <div className={styles.ruled}>
            {ASKS.map((a) => <div key={a} className={styles.askRow}><b>{t(`asks.${a}.say`)}</b><span>{t(`asks.${a}.does`)}</span></div>)}
          </div>
          <div className={styles.never}>
            <b>{t("neverTitle")}</b>
            {NEVER.map((n) => <span key={n} className={styles.neverItem}><span aria-hidden="true" className={styles.dash} />{t(`never.${n}`)}</span>)}
            <span className={styles.neverNote}>{t("neverNote")}</span>
          </div>
        </div>
      </section>

      <section className={`${styles.wrap} ${styles.closingRow}`}>
        <p className={`${styles.display} ${styles.closingMid}`}>{t.rich("closing", { mark: (c) => <span className={styles.mint}>{c}</span> })}</p>
        <Link href="/signin" className={`${styles.big} ${styles.bigLight}`}>{t("button")}</Link>
      </section>
    </SitePage>
  );
}
