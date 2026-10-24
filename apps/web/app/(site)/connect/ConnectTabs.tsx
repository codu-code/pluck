"use client";

import { useState } from "react";
import styles from "../site.module.css";

type Tool = { key: string; label: string; steps: string[]; codeLabel: string; code: string; note: string };

// "Install. Thirty seconds, honestly." One tab per kind of AI tool; the link is the same for all of them.
export function ConnectTabs({ tools }: { tools: Tool[] }) {
  const [current, setCurrent] = useState(tools[0]!.key);
  const [copied, setCopied] = useState(false);
  const tool = tools.find((t) => t.key === current)!;
  return (
    <>
      <div role="tablist" aria-label="Your AI tool" className={styles.tabs}>
        {tools.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            id={`tab-${t.key}`}
            aria-selected={t.key === current}
            aria-controls="tool-panel"
            className={styles.tab}
            onClick={() => { setCurrent(t.key); setCopied(false); }}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div role="tabpanel" id="tool-panel" aria-labelledby={`tab-${current}`} className={styles.panel}>
        <ol className={styles.steps}>
          {tool.steps.map((s, i) => (
            <li key={s}><span className={styles.stepNumber}>{i + 1}</span><span className={styles.stepText}>{s}</span></li>
          ))}
        </ol>
        <div className={styles.codeSide}>
          <span className={styles.codeLabel}>{tool.codeLabel}</span>
          <div className={styles.codeRow}>
            <code className={`${styles.code} ${styles.mono}`}>{tool.code}</code>
            <button
              type="button"
              className={styles.copy}
              onClick={async () => {
                await navigator.clipboard?.writeText(tool.code).catch(() => {});
                setCopied(true);
              }}
            >
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <span className={styles.codeNote}>{tool.note}</span>
        </div>
      </div>
    </>
  );
}
