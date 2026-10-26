import { fromIntlLocale } from "@pluck/i18n";
import type { Metadata } from "next";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import Link from "@/components/SiteLink";
import { notFound } from "next/navigation";
import { JsonLd } from "@/components/JsonLd";
import { findPost, POSTS, postBody } from "@/lib/blog";
import { pageMeta } from "@/lib/site";
import { localePath } from "@/lib/siteUrls";
import { SitePage } from "../../SiteChrome";
import styles from "../../site.module.css";
import { ORIGIN } from "@/lib/origin";

type Params = { params: Promise<{ slug: string }> };

export const dynamicParams = false;
export const generateStaticParams = () => POSTS.map((p) => ({ slug: p.slug }));

const postIn = async ({ params }: Params) => findPost(fromIntlLocale(await getLocale()), (await params).slug);

export async function generateMetadata(props: Params): Promise<Metadata> {
  const post = await postIn(props);
  if (!post) return {};
  return {
    title: `${post.title} · Pluck`,
    description: post.description,
    ...(await pageMeta(`/blog/${post.slug}`)),
    openGraph: { type: "article", title: post.title, description: post.description, publishedTime: post.date },
  };
}

const base = ORIGIN;

// One post, in the language of its URL: the reader's type (Source Serif at the reader's sizes) under the site's chrome.
export default async function BlogPost(props: Params) {
  const post = await postIn(props);
  if (!post) notFound();
  const { html, minutes } = postBody(post);
  const [t, format] = await Promise.all([getTranslations("site.blog"), getFormatter()]);
  const url = `${base}${localePath(post.locale, `/blog/${post.slug}`)}`;
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
          inLanguage: post.locale,
          url,
          mainEntityOfPage: url,
          image: `${base}/blog/${post.slug}/hero.png`,
          author: { "@type": "Organization", name: "Pluck", url: base },
          publisher: { "@type": "Organization", name: "Pluck", url: base, logo: `${base}/icon-512.png` },
        }}
      />
      <article className={styles.legal}>
        <div className={styles.legalHead}>
          <Link href="/blog" className={styles.postBack}>{t("all")}</Link>
          <h1 className={`${styles.display} ${styles.postTitle}`}>{post.title.replace(/\.$/, "")}{post.title.endsWith(".") && <span className={styles.dot}>.</span>}</h1>
          <span className={styles.postDate}>{format.dateTime(new Date(post.date), { dateStyle: "long" })} · {t("minutes", { minutes })}{post.draft && <b className={styles.postDraft}> · Draft</b>}</span>
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
