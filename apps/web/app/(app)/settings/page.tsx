import type { Metadata } from "next";
import { currentUser } from "@/lib/auth";
import { aiTaggedCount, tagsOf } from "@/lib/library";
import { TagsSection } from "./TagsSection";
import styles from "./settings.module.css";

export const metadata: Metadata = { title: "Settings · Pluck" };

// Settings from the board. Sections land with their slices: tags now; AI tools, email-in, keys,
// expiry, import, export and delete later.
export default async function Settings() {
  const user = (await currentUser())!;
  const [tags, aiWeek] = await Promise.all([tagsOf(user.id), aiTaggedCount(user.id, 7)]);
  return (
    <div className={styles.page}>
      <div className={styles.head}>
        <h1 className={styles.title}>Settings</h1>
        <span className={styles.meta}>{user.email} · signed in with an email link</span>
      </div>
      <TagsSection initial={tags} aiWeek={aiWeek} />
    </div>
  );
}
