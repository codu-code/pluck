import { fromIntlLocale } from "@pluck/i18n";
import type { Metadata } from "next";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { JsonLd } from "@/components/JsonLd";
import { findPost, POSTS, postBody } from "@/lib/blog";
import { SitePage } from "../../SiteChrome";
import styles from "../../site.module.css";

type Params = { params: Promise<{ slug: string }> };

export const dynamicParams = false;
export const generateStaticParams = () => POSTS.map((p) => ({ slug: p.slug }));

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const post = findPost((await params).slug);
  if (!post) return {};
  return {
    title: `${post.title} · Pluck`,
    description: post.description,
    alternates: { canonical: `/blog/${post.slug}` },
    openGraph: { type: "article", title: post.title, description: post.description, publishedTime: post.date },
  };
}

const base = process.env.BETTER_AUTH_URL ?? "http://localhost:3000";

// One post: the reader's type (Source Serif at the reader's sizes) under the site's chrome. Posts are in English.
export default async function BlogPost({ params }: Params) {
  const post = findPost((await params).slug);
  if (!post) notFound();
  const { html, minutes } = postBody(post);
  const [t, format, locale] = await Promise.all([getTranslations("site.blog"), getFormatter(), getLocale()]);
  const url = `${base}/blog/${post.slug}`;
  return (
    <SitePage page="blog">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "BlogPosting",
          headline: post.title,
          description: post.description,
          keywords: post.keywords.join(", "),
          datePublished: post.date,
          dateModified: post.date,
          inLanguage: "en",
          url,
          mainEntityOfPage: url,
          image: `${base}/blog/${post.slug}/hero.png`,
          author: { "@type": "Organization", name: "Pluck", url: base },
          publisher: { "@type": "Organization", name: "Pluck", url: base, logo: `${base}/icon-512.png` },
        }}
      />
      <article className={styles.legal} lang="en">
        <div className={styles.legalHead}>
          <Link href="/blog" className={styles.postBack}>{t("all")}</Link>
          <h1 className={`${styles.display} ${styles.postTitle}`}>{post.title.replace(/\.$/, "")}{post.title.endsWith(".") && <span className={styles.dot}>.</span>}</h1>
          <span className={styles.postDate}>{format.dateTime(new Date(post.date), { dateStyle: "long" })} · {t("minutes", { minutes })}{post.draft && <b className={styles.postDraft}> · Draft</b>}</span>
          {fromIntlLocale(locale) !== "en" && <p className={styles.legalNote}>{t("englishOnly")}</p>}
        </div>
        <div className={styles.postBody} dangerouslySetInnerHTML={{ __html: html }} />
        <section className={styles.legalBox}>
          <b>{t("box.title")}</b>
          <span>{t.rich("box.body", { link: (c) => <Link href="/signin">{c}</Link> })}</span>
        </section>
      </article>
    </SitePage>
  );
}
