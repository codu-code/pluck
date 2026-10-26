import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import Link from "@/components/SiteLink";
import type { ReactNode } from "react";
import { JsonLd } from "@/components/JsonLd";
import { REPO_URL, pageMeta } from "@/lib/site";
import { SitePage } from "../SiteChrome";
import styles from "../site.module.css";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("site.support.meta");
  return { title: t("title"), description: t("description"), ...(await pageMeta("/support")) };
}

// Each topic's answers, by key under site.support.<topic>.
const TOPICS = [
  { id: "extension", key: "extension", answers: ["extension.pluckPage", "extension.quote", "extension.dot", "extension.login", "extension.server"] },
  { id: "iphone", key: "iphone", answers: ["iphone.share", "iphone.offline", "iphone.server"] },
  { id: "ai", key: "ai", answers: ["ai.connect", "ai.change", "ai.disconnect"] },
  { id: "account", key: "account", answers: ["account.signIn", "account.oldItems", "account.deleted", "account.monday", "account.export", "account.delete"] },
  { id: "self-host", key: "selfHost", answers: ["selfHost.run"] },
] as const;

// The markup answers can use: shortcuts (the keys stay as they are on the keyboard) and links to other pages.
const RICH = {
  pluckKeys: () => <><kbd>Alt</kbd> <kbd>Shift</kbd> <kbd>P</kbd></>,
  highlightKeys: () => <><kbd>Alt</kbd> <kbd>Shift</kbd> <kbd>H</kbd></>,
  connect: (c: ReactNode) => <Link href="/connect">{c}</Link>,
  openSource: (c: ReactNode) => <Link href="/open-source">{c}</Link>,
};

// The same markup as plain text, for the FAQ structured data.
const PLAIN = { pluckKeys: () => "Alt Shift P", highlightKeys: () => "Alt Shift H", connect: (c: string) => c, openSource: (c: string) => c };

export default async function Support() {
  const t = await getTranslations("site.support");
  const faq = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: TOPICS.flatMap((x) => x.answers.map((a) => ({ "@type": "Question", name: t(`${a}.q`), acceptedAnswer: { "@type": "Answer", text: t.markup(`${a}.a`, PLAIN) } }))),
  };
  return (
    <SitePage page="support">
      <JsonLd data={faq} />
      <section className={`${styles.wrap} ${styles.pageHero}`}>
        <h1 className={`${styles.display} ${styles.supportTitle}`}>{t.rich("title", { dot: (c) => <span className={styles.dot}>{c}</span> })}</h1>
        <p className={styles.heroPara}>{t.rich("lede", { bugs: (c) => <a href="#bugs">{c}</a> })}</p>
        <nav aria-label={t("topicsLabel")} className={styles.topics}>
          {TOPICS.map((x) => <a key={x.id} href={`#${x.id}`} className={styles.topic}>{t(`${x.key}.title`)}</a>)}
        </nav>
      </section>

      {TOPICS.map((x) => (
        <section key={x.id} id={x.id} aria-labelledby={`${x.id}-title`} className={`${styles.wrap} ${styles.supportTopic}`}>
          <h2 id={`${x.id}-title`} className={`${styles.display} ${styles.supportTopicTitle}`}>{t(`${x.key}.title`)}</h2>
          <div className={styles.answers}>
            {x.answers.map((a) => (
              <div key={a} className={styles.answer}>
                <h3>{t(`${a}.q`)}</h3>
                <p>{t.rich(`${a}.a`, RICH)}</p>
              </div>
            ))}
          </div>
        </section>
      ))}

      <section id="bugs" className={`${styles.wrap} ${styles.bugsSection}`}>
        <div className={styles.bugCard}>
          <div className={styles.bugCopy}>
            <h2 className={`${styles.display} ${styles.h2Mid}`}>{t.rich("bugs.title", { mark: (c) => <span className={styles.mint}>{c}</span> })}</h2>
            <p className={styles.aiPara}>{t("bugs.body")}</p>
            <p className={styles.bugNote}>{t("bugs.note")}</p>
          </div>
          <a href={`${REPO_URL}/issues`} className={`${styles.big} ${styles.bigLight}`}>{t("bugs.button")}</a>
        </div>
      </section>
    </SitePage>
  );
}
