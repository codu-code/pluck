import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { REPO_URL } from "@/lib/site";
import { SitePage } from "../SiteChrome";
import styles from "../site.module.css";

export const metadata: Metadata = {
  title: "Support · Pluck",
  description: "Answers for the Pluck extension, the iPhone app, your AI and your account, and where to report a bug.",
};

type Answer = { q: string; a: ReactNode };

const TOPICS: { id: string; title: string; answers: Answer[] }[] = [
  {
    id: "extension",
    title: "The extension",
    answers: [
      { q: "How do I pluck the page I am on?", a: <>Click the Pluck button in the toolbar, or press <kbd>Alt</kbd> <kbd>Shift</kbd> <kbd>P</kbd>. Right-click a link or an image to pluck that instead.</> },
      { q: "Can I keep a quote, not the whole page?", a: <>Select the words and press <kbd>Alt</kbd> <kbd>Shift</kbd> <kbd>H</kbd>. Pluck keeps the page with your selection as a highlight on it.</> },
      { q: "Why is there a dot on the Pluck button?", a: "You plucked something with no connection. It waits on your computer and goes up by itself once you are back online. The dot goes when it does." },
      { q: "A page behind my login came out empty.", a: "In the extension's options, turn on Send page content with plucks. Pluck then keeps the page as your browser shows it, not as it looks to a stranger." },
      { q: "How do I use it with my own server?", a: "Build the extension for your server with the self-host guide in the repository, then load it in your browser. Sign in, or paste an API key from Settings." },
    ],
  },
  {
    id: "iphone",
    title: "iPhone",
    answers: [
      { q: "How do I pluck from Safari or another app?", a: "Tap Share, then Pluck. If you cannot see it, scroll the row of apps to the end, tap More, and add Pluck to your favourites." },
      { q: "I plucked something offline. Where did it go?", a: "It waits on your phone and goes up the next time you open Pluck with a connection." },
      { q: "Can the app use my own server?", a: "Yes. On the sign-in screen, choose Use your own server and enter its address." },
    ],
  },
  {
    id: "ai",
    title: "Your AI",
    answers: [
      { q: "How do I connect my AI tool?", a: <>Every tool takes the same link. <Link href="/connect">Connect your AI</Link> has the steps for Claude, ChatGPT, Cursor and the rest.</> },
      { q: "What can my AI change?", a: "It can pluck, tag, sort and make private lists when you ask. It cannot delete anything unless you allowed that when you connected it, and it cannot make a list public: only you can, from the list in Pluck. Everything it adds is marked by AI." },
      { q: "How do I disconnect it?", a: "Settings, AI tools, Disconnect. It stops working at once, not at the end of its session." },
    ],
  },
  {
    id: "account",
    title: "Your library and account",
    answers: [
      { q: "The sign-in link did not work.", a: "A link works once, for 10 minutes. Ask for a new one from the same browser. If Pluck says you asked for too many, use the latest one or wait an hour." },
      { q: "Where did my old items go?", a: "Items you have not touched in a while move to the Archive, nothing is deleted. You choose how long, or turn it off, in Settings under Expiry and archive." },
      { q: "I deleted something by mistake.", a: "Deleted items wait in the Bin for 30 days. It is linked at the bottom of the Archive. Open the item and restore it." },
      { q: "How do I stop the Monday email?", a: "Use the stop link at the bottom of any of them, or pick another day or none in Settings under Expiry and archive." },
      { q: "Can I take everything with me?", a: "Settings, Export everything. You get an email with a zip: every item as JSON, plus a Markdown file for each item and each list, with your notes and highlights." },
      { q: "How do I delete my account?", a: "Settings, Delete account. Type your email to confirm. Your items, lists, files and keys go straight away." },
    ],
  },
  {
    id: "self-host",
    title: "Running your own",
    answers: [
      { q: "How do I run Pluck myself?", a: <>One command with Docker. <Link href="/open-source">Open source</Link> shows it, and the self-host guide in the repository covers mail, storage and putting it on a server.</> },
    ],
  },
];

export default function Support() {
  return (
    <SitePage page="support">
      <section className={`${styles.wrap} ${styles.pageHero}`}>
        <h1 className={`${styles.display} ${styles.supportTitle}`}>Help<span className={styles.dot}>.</span></h1>
        <p className={styles.heroPara}>Short answers for the extension, the iPhone app, your AI and your account. Something broken? <a href="#bugs">Tell us on GitHub</a>.</p>
        <nav aria-label="Topics" className={styles.topics}>
          {TOPICS.map((t) => <a key={t.id} href={`#${t.id}`} className={styles.topic}>{t.title}</a>)}
        </nav>
      </section>

      {TOPICS.map((t) => (
        <section key={t.id} id={t.id} aria-labelledby={`${t.id}-title`} className={`${styles.wrap} ${styles.supportTopic}`}>
          <h2 id={`${t.id}-title`} className={`${styles.display} ${styles.supportTopicTitle}`}>{t.title}</h2>
          <div className={styles.answers}>
            {t.answers.map((x) => (
              <div key={x.q} className={styles.answer}>
                <h3>{x.q}</h3>
                <p>{x.a}</p>
              </div>
            ))}
          </div>
        </section>
      ))}

      <section id="bugs" className={`${styles.wrap} ${styles.bugsSection}`}>
        <div className={styles.bugCard}>
          <div className={styles.bugCopy}>
            <h2 className={`${styles.display} ${styles.h2Mid}`}>Found a bug<span className={styles.mint}>?</span></h2>
            <p className={styles.aiPara}>Open an issue on GitHub. Say what you did, what you expected, and what happened instead. Ideas are welcome there too.</p>
            <p className={styles.bugNote}>Issues are public. Leave out links, notes or anything else you would rather keep to yourself.</p>
          </div>
          <a href={`${REPO_URL}/issues`} className={`${styles.big} ${styles.bigLight}`}>Open an issue</a>
        </div>
      </section>
    </SitePage>
  );
}
