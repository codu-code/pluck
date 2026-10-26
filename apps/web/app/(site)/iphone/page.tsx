import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { TESTFLIGHT_APP_URL, TESTFLIGHT_URL, pageAlternates } from "@/lib/site";
import { SitePage } from "../SiteChrome";
import styles from "../site.module.css";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("site.iphone.meta");
  return { title: t("title"), description: t("description"), alternates: await pageAlternates("/iphone") };
}

const STEPS = ["get", "join", "signIn", "share"] as const;

// Where "iPhone" lands while the app is in public beta on TestFlight (APP_STORE_URL in lib/site.ts): how to install it,
// in four steps, and a code to scan for anyone reading on a computer.
export default async function IPhone() {
  const t = await getTranslations("site.iphone");
  const link = (href: string) => (c: React.ReactNode) => <a href={href} className={styles.inlineLink}>{c}</a>;
  return (
    <SitePage page="iphone">
      <section className={`${styles.wrap} ${styles.pageHero} ${styles.soon}`}>
        <h1 className={`${styles.display} ${styles.supportTitle}`}>{t.rich("title", { dot: (c) => <span className={styles.dot}>{c}</span> })}</h1>
        <p className={styles.heroPara}>{t("lede")}</p>
        <div className={styles.buttons}>
          <a href={TESTFLIGHT_URL} className={`${styles.big} ${styles.bigPrimary}`}>{t("join")}</a>
        </div>
        <div className={styles.beta}>
          <ol className={styles.steps}>
            {STEPS.map((step, i) => (
              <li key={step}>
                <span className={styles.stepNumber} aria-hidden="true">{i + 1}</span>
                <div className={styles.stepText}>
                  <b>{t(`steps.${step}.title`)}</b>
                  <p className={styles.betaStep}>{t.rich(`steps.${step}.body`, { app: link(TESTFLIGHT_APP_URL), invite: link(TESTFLIGHT_URL) })}</p>
                </div>
              </li>
            ))}
          </ol>
          <figure className={styles.qr}>
            <img src="/testflight-qr.svg" width={176} height={176} alt={t("qrAlt")} />
            <figcaption>{t("desktop")}</figcaption>
          </figure>
        </div>
        <p className={styles.betaNote}>{t("needs")}</p>
        <p className={styles.betaNote}>{t("feedback")}</p>
      </section>
    </SitePage>
  );
}
