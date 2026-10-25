import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { Fragment } from "react";
import { Dot, Standalone, standaloneStyles as s } from "@/components/Standalone";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("app.meta"))("extensionConnected"), robots: { index: false } };
}

const Keys = ({ keys }: { keys: string[] }) => (
  <span className={s.keys}>
    {keys.map((k, i) => (
      <Fragment key={k}>
        {i > 0 && <span className={s.keyPlus} aria-hidden="true">+</span>}
        <kbd className={s.key}>{k}</kbd>
      </Fragment>
    ))}
  </span>
);

// Where the extension's sign-in ends. The extension reads the code from this tab's address (it holds the
// PKCE verifier, so the code is useless to anyone else) and closes the tab.
export default function Connected() {
  const t = useTranslations("app.extensionConnected");
  return (
    <Standalone
      title={<>{t("title")}<Dot /></>}
      lede={t("lede")}
      artIsContent
      art={
        <div className={s.keyArt}>
          <div className={s.keyRow}>
            <Keys keys={["Alt", "Shift", "P"]} />
            <p className={s.keyNote}>{t("page")}</p>
          </div>
          <div className={s.keyRow}>
            <Keys keys={["Alt", "Shift", "H"]} />
            <p className={s.keyNote}>{t("selection")}</p>
          </div>
        </div>
      }
    />
  );
}
