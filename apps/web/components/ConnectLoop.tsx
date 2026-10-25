import { useTranslations } from "next-intl";
import type { CSSProperties } from "react";
import s from "./ConnectLoop.module.css";

// The 10-second "connect your AI" loop from the design canvas (ConnectLoop board). Pure CSS: a server component, no script.
// The stage is drawn at 1200 x 750; wrap it in <ConnectLoopFit> to scale it to its column.
// Pass `at` (ms) to freeze one frame, for stills and the recording script.
export function ConnectLoop({ className, at }: { className?: string; at?: number }) {
  const t = useTranslations("app.connectLoop");
  const style = at == null ? undefined : ({ "--at": `-${at / 1000}s`, "--play": "paused" } as CSSProperties);
  return (
    <div style={style}>
<div className={`${s.loop} ${className ?? ""}`} role="img" aria-label={t("label")}>
<span className={s.logo} aria-hidden="true">pluck<svg viewBox="0 0 12 12"><path d="M2.2 5.6L2.8 2.3M5 7.4L8 4.7M5.8 10.6L9.4 9.85" fill="none" stroke="#34A07C" strokeWidth="2" strokeLinecap="round"/></svg></span>
<div className={s.cap1}><span className={s.capT}>{t("cap1.title")}<span className={s.dot}>.</span></span><span className={s.capS}>{t("cap1.body")}</span></div>
<div className={s.cap2}><span className={s.capT}>{t("cap2.title")}<span className={s.dot}>.</span></span><span className={s.capS}>{t("cap2.body")}</span></div>
<div className={s.cap3}><span className={s.capT}>{t("cap3.title")}<span className={s.dot}>.</span></span><span className={s.capS}>{t("cap3.body")}</span></div>
<div className={s.dots}><span className={s.bar}><span className={s.d1}></span></span><span className={s.bar}><span className={s.d2}></span></span><span className={s.bar}><span className={s.d3}></span></span></div>
<div className={s.win}>
<div className={s.side}><div className={s.lights}><span className={s.light}></span><span className={s.light}></span><span className={s.light}></span></div><div className={s.newchat}>{t("newChat")}</div><div className={s.hist} style={{ width: "80%" }}></div><div className={s.hist} style={{ width: "64%" }}></div><div className={s.hist} style={{ width: "72%" }}></div><div className={s.hist} style={{ width: "50%" }}></div></div>
<div className={s.main}>
<div className={s.top}>{t("chat")}</div>
<div className={s.thread}>
<div className={s.me}>{t("question")}</div>
<span className={s.tool}><svg width="12" height="12" viewBox="0 0 12 12"><circle cx="6" cy="6" r="4.5" fill="none" stroke="#6B7079" strokeWidth="1.4"/><path d="M6 3.6V6l1.6 1" fill="none" stroke="#6B7079" strokeWidth="1.4" strokeLinecap="round"/></svg>pluck · search_items “mcp auth”</span>
<div className={s.ai}>
<span className={s.ans}>{t("answer")}</span>
<div className={s.c1}><svg width="16" height="16" viewBox="0 0 16 16"><path d="M3 4.5h10M3 8h10M3 11.5h6" fill="none" stroke="#151A13" strokeWidth="1.4" strokeLinecap="round"/></svg><span className={s.cardText}><span className={s.cardTitle}>{t("cards.one")}</span><span className={s.cardMeta}>modelcontextprotocol.io · 12 min</span></span><span className={s.tag}>mcp</span></div>
<div className={s.c2}><svg width="16" height="16" viewBox="0 0 16 16"><path d="M3 4.5h10M3 8h10M3 11.5h6" fill="none" stroke="#151A13" strokeWidth="1.4" strokeLinecap="round"/></svg><span className={s.cardText}><span className={s.cardTitle}>{t("cards.two")}</span><span className={s.cardMeta}>{t("cards.twoMeta")}</span></span><span className={s.tag}>auth</span></div>
<div className={s.c3}><svg width="16" height="16" viewBox="0 0 16 16"><path d="M3.5 3h9a1.5 1.5 0 0 1 1.5 1.5v7a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 2 11.5v-7A1.5 1.5 0 0 1 3.5 3zM6.75 6v4l3.25-2z" fill="none" stroke="#151A13" strokeWidth="1.4" strokeLinejoin="round"/></svg><span className={s.cardText}><span className={s.cardTitle}>{t("cards.three")}</span><span className={s.cardMeta}>youtube.com · 18 min</span></span><span className={s.tag}>mcp</span></div>
<span className={s.more}>{t("followUp")}</span>
</div>
</div>
<span className={s.pill}><span className={s.ptile}><svg width="14" height="14" viewBox="0 0 20 20"><path d="M4.8 7.3v10" stroke="#F6F8F4" strokeWidth="4" strokeLinecap="round"/><circle cx="8.8" cy="9.7" r="3.5" fill="none" stroke="#F6F8F4" strokeWidth="3.4"/><path d="M14.1 4.4L15.5 3M15.4 7.4L17.2 7.1M11.6 2.3L11.8 0.9" stroke="#7FD3AE" strokeWidth="2.2" strokeLinecap="round"/></svg></span>{t("connected")}</span>
<div className={s.composer}><span className={s.typed}><span className={s.ph}>{t("message")}</span><span className={s.q}>{t("question")}</span></span><span className={s.send}><svg width="14" height="14" viewBox="0 0 16 16"><path d="M8 13V3M3.5 7.5L8 3l4.5 4.5" fill="none" stroke="#FFFFFF" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg></span></div>
<div className={s.scrim}></div>
<div className={s.modal}><span className={s.modalT}>{t("modal.title")}</span><span className={s.modalP}>{t("modal.body")}</span><div className={s.field}><span className={s.url}>https://getpluck.io/mcp</span></div><div className={s.row}><span className={s.ghost}>{t("modal.cancel")}</span><span className={s.add}>{t("modal.add")}</span></div></div>
<div className={s.consent}>
<span className={s.clogo}>pluck<svg viewBox="0 0 12 12"><path d="M2.2 5.6L2.8 2.3M5 7.4L8 4.7M5.8 10.6L9.4 9.85" fill="none" stroke="#34A07C" strokeWidth="2" strokeLinecap="round"/></svg></span>
<span className={s.consentT}>{t("consent.title")}<span className={s.dot}>.</span></span>
<span className={s.consentP}>{t("consent.body")}</span>
<div className={s.scopes}><span className={s.scope}><span className={s.tick}><svg width="11" height="11" viewBox="0 0 16 16"><path d="M3.5 8.5l3 3 6-7" fill="none" stroke="#151A13" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"/></svg></span>{t("consent.read")}</span><span className={s.scope}><span className={s.tick}><svg width="11" height="11" viewBox="0 0 16 16"><path d="M3.5 8.5l3 3 6-7" fill="none" stroke="#151A13" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"/></svg></span>{t("consent.write")}</span><span className={s.scopeNo}><span className={s.no}><span className={s.noBar}></span></span>{t("consent.delete")}</span></div>
<div className={s.pbtns}><span className={s.cancel}>{t("consent.cancel")}</span><span className={s.allow}>{t("consent.allow")}</span></div>
</div>
</div>
</div>
<span className={s.r1}></span><span className={s.r2}></span><span className={s.r3}></span>
<svg className={s.cursor} viewBox="0 0 22 26" aria-hidden="true"><path d="M2 2v19l5-4.6 3.4 7.4 3.4-1.5-3.4-7.3H17z" fill="#22252A" stroke="#FFFFFF" strokeWidth="1.6" strokeLinejoin="round"/></svg>
</div>
    </div>
  );
}
