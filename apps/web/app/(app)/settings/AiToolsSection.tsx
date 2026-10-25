"use client";

import type { AiConnection } from "@pluck/shared-schemas";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { ConnectLoop } from "@/components/ConnectLoop";
import { ConnectLoopFit } from "@/components/ConnectLoopFit";
import { useToast } from "@/components/Toast";
import { useFormat } from "@/components/useFormat";
import styles from "./settings.module.css";

// AI tools (Settings board): how to connect any MCP client, and which ones are connected.
export function AiToolsSection({ connectorUrl, keyPrefix, initial, lastCallAt }: { connectorUrl: string; keyPrefix: string | null; initial: AiConnection[]; lastCallAt: string | null }) {
  const [tools, setTools] = useState(initial);
  const [toast, showToast] = useToast();
  const t = useTranslations("app.settings.ai");
  const app = useTranslations("app.common");
  const { ago } = useFormat();
  const testPrompt = t("testPrompt");
  const [lastCall, setLastCall] = useState<string | null>(null); // relative time is worked out after hydration
  useEffect(() => setLastCall(lastCallAt && ago(lastCallAt)), [lastCallAt, ago]); // a new ago each render sets the same string: no loop
  const hosted = new URL(connectorUrl).hostname === "getpluck.io";
  const npx = `npx @pluck/mcp${hosted ? "" : ` --server ${new URL(connectorUrl).origin}`} --key ${keyPrefix ? `pk_live_${keyPrefix}••••` : "pk_live_…"}`;
  const copy = async (text: string, copied: string) => {
    await navigator.clipboard?.writeText(text).catch(() => {});
    showToast({ message: copied });
  };
  const connected = tools.length > 0 || lastCallAt !== null;
  return (
    <section id="ai" className={styles.section}>
      <h2 className={styles.h2}>{t("title")}</h2>
      <p className={styles.meta} style={{ maxWidth: 600 }}>
        {t("lede")}
      </p>
      <div className={styles.aiGrid}>
        <div className={styles.aiSteps}>
          <div className={styles.field}>
            <span className={styles.label}>{t("connector")}</span>
            <span className={styles.copyRow}>
              <code className={styles.code}>{connectorUrl}</code>
              <button type="button" className={styles.primaryButton} onClick={() => copy(connectorUrl, t("connectorCopied"))}>{app("copy")}</button>
            </span>
          </div>
          <div className={styles.field}>
            <span className={styles.label}>Claude Code</span>
            <span className={styles.copyRow}>
              <code className={styles.code}>claude mcp add --transport http pluck {connectorUrl}</code>
              <button type="button" className={styles.small} style={{ height: 40 }} onClick={() => copy(`claude mcp add --transport http pluck ${connectorUrl}`, t("commandCopied"))}>{app("copy")}</button>
            </span>
          </div>
          <div className={styles.field}>
            <span className={styles.label}>{t("selfHost")}</span>
            <code className={styles.codeQuiet}>{npx}</code>
            {!keyPrefix && <span className={styles.meta} style={{ fontSize: 13 }}>{t("needKey")}</span>}
          </div>
          <div className={styles.inline} style={{ gap: 12 }}>
            {/* Copies the question rather than opening one vendor's site: any AI tool works. */}
            <button type="button" className={styles.inkButton} onClick={async () => {
              await navigator.clipboard?.writeText(testPrompt).catch(() => {});
              showToast({ message: app("copiedForAi") });
            }}>
              {t("test")}
            </button>
            <span className={styles.meta} style={{ fontSize: 13 }}>{t("testHint", { prompt: testPrompt })}</span>
          </div>
        </div>
        <div className={styles.aiSide}>
          <div className={styles.loopFrame}><ConnectLoopFit><ConnectLoop /></ConnectLoopFit></div>
          <span className={styles.status}>
            <span aria-hidden="true" className={styles.statusDot} style={{ background: connected ? "var(--accent)" : "var(--line-strong)" }} />
            {connected ? (lastCall ? t("connectedLast", { ago: lastCall }) : t("connected")) : t("notConnected")}
          </span>
          {tools.map((tool) => (
            <div key={tool.clientId} className={styles.keyRow}>
              <span>
                <b>{tool.name}</b> <span className={styles.meta}>· {tool.scopes.includes("library:write") ? t("readsWrites") : t("reads")}</span>
              </span>
              <button
                type="button"
                className={styles.small}
                onClick={async () => {
                  const res = await fetch("/api/v1/ai-tools/disconnect", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ clientId: tool.clientId }) });
                  if (res.ok) {
                    setTools((cur) => cur.filter((x) => x.clientId !== tool.clientId));
                    showToast({ message: t("disconnected", { name: tool.name }) });
                  }
                }}
              >
                {t("disconnect")}
              </button>
            </div>
          ))}
        </div>
      </div>
      {toast}
    </section>
  );
}
