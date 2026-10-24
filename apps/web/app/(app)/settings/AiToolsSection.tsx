"use client";

import type { AiConnection } from "@pluck/shared-schemas";
import { useEffect, useState } from "react";
import { useToast } from "@/components/Toast";
import { ago } from "@/lib/format";
import styles from "./settings.module.css";

const TEST_PROMPT = "What did I pluck this week?";

// AI tools (Settings board): how to connect any MCP client, and which ones are connected.
export function AiToolsSection({ connectorUrl, keyPrefix, initial, lastCallAt }: { connectorUrl: string; keyPrefix: string | null; initial: AiConnection[]; lastCallAt: string | null }) {
  const [tools, setTools] = useState(initial);
  const [toast, showToast] = useToast();
  const [lastCall, setLastCall] = useState<string | null>(null); // relative time is worked out after hydration
  useEffect(() => setLastCall(lastCallAt && ago(lastCallAt)), [lastCallAt]);
  const hosted = new URL(connectorUrl).hostname === "getpluck.io";
  const npx = `npx @pluck/mcp${hosted ? "" : ` --server ${new URL(connectorUrl).origin}`} --key ${keyPrefix ? `pk_live_${keyPrefix}••••` : "pk_live_…"}`;
  const copy = async (text: string, what: string) => {
    await navigator.clipboard?.writeText(text).catch(() => {});
    showToast({ message: `${what} copied.` });
  };
  const connected = tools.length > 0 || lastCallAt !== null;
  return (
    <section id="ai" className={styles.section}>
      <h2 className={styles.h2}>AI tools</h2>
      <p className={styles.meta} style={{ maxWidth: 600 }}>
        Your library, in the AI tool you already use, in thirty seconds. It reads everything, changes things only when you ask, and can never delete.
      </p>
      <div className={styles.aiGrid}>
        <div className={styles.aiSteps}>
          <div className={styles.field}>
            <span className={styles.label}>Connector URL, for Claude, ChatGPT, Cursor and any MCP client</span>
            <span className={styles.copyRow}>
              <code className={styles.code}>{connectorUrl}</code>
              <button type="button" className={styles.primaryButton} onClick={() => copy(connectorUrl, "Connector URL")}>Copy</button>
            </span>
          </div>
          <div className={styles.field}>
            <span className={styles.label}>Claude Code</span>
            <span className={styles.copyRow}>
              <code className={styles.code}>claude mcp add --transport http pluck {connectorUrl}</code>
              <button type="button" className={styles.small} style={{ height: 40 }} onClick={() => copy(`claude mcp add --transport http pluck ${connectorUrl}`, "Command")}>Copy</button>
            </span>
          </div>
          <div className={styles.field}>
            <span className={styles.label}>Self-hosting without a public URL</span>
            <code className={styles.codeQuiet}>{npx}</code>
            {!keyPrefix && <span className={styles.meta} style={{ fontSize: 13 }}>Make an API key below, then use it here.</span>}
          </div>
          <div className={styles.inline} style={{ gap: 12 }}>
            <a className={styles.inkButton} style={{ display: "inline-flex", alignItems: "center", textDecoration: "none" }} href={`https://claude.ai/new?q=${encodeURIComponent(TEST_PROMPT)}`} target="_blank" rel="noreferrer">
              Test it
            </a>
            <span className={styles.meta} style={{ fontSize: 13 }}>Opens your AI with “{TEST_PROMPT}”</span>
          </div>
        </div>
        <div className={styles.aiSide}>
          <div className={styles.gif}>[CONNECTOR GIF]</div>
          <span className={styles.status}>
            <span aria-hidden="true" className={styles.statusDot} style={{ background: connected ? "var(--accent)" : "var(--line-strong)" }} />
            {connected ? `Connected${lastCall ? ` · last call ${lastCall}` : ""}` : "Not connected yet"}
          </span>
          {tools.map((t) => (
            <div key={t.clientId} className={styles.keyRow}>
              <span>
                <b>{t.name}</b> <span className={styles.meta}>· {t.scopes.includes("library:write") ? "reads and organises" : "reads"}</span>
              </span>
              <button
                type="button"
                className={styles.small}
                onClick={async () => {
                  const res = await fetch("/api/v1/ai-tools/disconnect", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ clientId: t.clientId }) });
                  if (res.ok) {
                    setTools((cur) => cur.filter((x) => x.clientId !== t.clientId));
                    showToast({ message: `${t.name} disconnected. It cannot reach your library now.` });
                  }
                }}
              >
                Disconnect
              </button>
            </div>
          ))}
        </div>
      </div>
      {toast}
    </section>
  );
}
