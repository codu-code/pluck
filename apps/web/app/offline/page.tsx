import { useTranslations } from "next-intl";
import Link from "next/link";
import { Actions, Dot, Standalone, standaloneStyles as s } from "@/components/Standalone";
import { Retry } from "./Retry";

// What the app shows when it is opened with no connection (the service worker serves this page). Rendered per
// request, in the reader's language, so the copy the service worker keeps is in it too.
export default function Offline() {
  const t = useTranslations("app.offline");
  return (
    <Standalone
      title={[t("title1"), <>{t("title2")}<Dot /></>]}
      lede={t("lede")}
      art={
        <div className={s.panel}>
          <div className={s.panelHead}><b>{t("art.inbox")}</b><time>{t("art.waiting", { count: 2 })}</time></div>
          <div className={s.entry}><span className={s.dotClay} /><span className={s.entryText}><b>{t("art.one")}</b><span>{t("art.oneNote")}</span></span></div>
          <div className={s.entry}><span className={s.dotClay} /><span className={s.entryText}><b>{t("art.two")}</b><span>{t("art.twoNote")}</span></span></div>
          <div className={s.entry}><span className={s.ring} /><span className={s.entryText}><b>{t("art.three")}</b><span>{t("art.threeNote")}</span></span></div>
        </div>
      }
    >
      <Actions>
        <Retry />
        <Link href="/inbox" className={s.textLink}>{t("openInbox")}</Link>
      </Actions>
    </Standalone>
  );
}
