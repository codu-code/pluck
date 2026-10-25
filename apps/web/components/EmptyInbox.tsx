import { useTranslations } from "next-intl";
import Link from "next/link";
import styles from "./EmptyInbox.module.css";

// The Empty board's three ways to start.
export function EmptyInbox() {
  const t = useTranslations("app.emptyInbox");
  return (
    <div className={styles.empty}>
      <div className={styles.head}>
        <h1 className={styles.title}>{t("title")}</h1>
        <p className={styles.lede}>{t("lede")}</p>
      </div>
      <ol className={styles.steps}>
        <li className={styles.step}>
          <span className={styles.num}>1</span>
          <span className={styles.text}>
            <b>{t("one.title")}</b>
            <span>{t("one.body")}</span>
          </span>
        </li>
        <li className={styles.step}>
          <span className={styles.num}>2</span>
          <span className={styles.text}>
            <b>{t("two.title")}</b>
            <span>{t("two.body")}</span>
          </span>
          <span className={styles.actions}>
            <Link href="/connect#extension" className={styles.action}>{t("two.chrome")}</Link>
          </span>
        </li>
        <li className={styles.step}>
          <span className={styles.num}>3</span>
          <span className={styles.text}>
            <b>{t("three.title")}</b>
            <span>{t("three.body")}</span>
          </span>
          <span className={styles.actions}>
            <Link href="/connect#ios" className={styles.action}>{t("three.ios")}</Link>
            <Link href="/settings#shortcut" className={styles.action}>{t("three.shortcut")}</Link>
          </span>
        </li>
      </ol>
    </div>
  );
}

// A quiet empty state for the other lists.
export function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className={styles.empty}>
      <div className={styles.head}>
        <h1 className={styles.title}>{title}</h1>
        <p className={styles.lede}>{body}</p>
      </div>
    </div>
  );
}
