import type { Metadata } from "next";
import { getFormatter, getTranslations } from "next-intl/server";
import Link from "next/link";
import { POSTS } from "@/lib/blog";
import { SitePage } from "../SiteChrome";
import styles from "../site.module.css";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("site.blog.meta");
  return { title: t("title"), description: t("description"), alternates: { canonical: "/blog" } };
}

// The posts, newest first, in the legal pages' shape: a title, a lede, then one ruled section each.
export default async function Blog() {
  const t = await getTranslations("site");
  const format = await getFormatter();
  return (
    <SitePage page="blog" footerNote={t("chrome.freeAndOpen")}>
      <div className={styles.legal}>
        <div className={styles.legalHead}>
          <h1 className={`${styles.display} ${styles.legalTitle}`}>{t.rich("blog.title", { dot: (c) => <span className={styles.dot}>{c}</span> })}</h1>
          <p className={styles.legalLede}>{t("blog.lede")}</p>
        </div>
        {POSTS.map((p) => (
          <section key={p.slug} className={styles.legalSection} lang="en">
            <span className={styles.postDate}>{format.dateTime(new Date(p.date), { dateStyle: "long" })}{p.draft && <b className={styles.postDraft}> · Draft</b>}</span>
            <h2><Link href={`/blog/${p.slug}`}>{p.title}</Link></h2>
            <p>{p.description}</p>
          </section>
        ))}
      </div>
    </SitePage>
  );
}
