import type { Metadata } from "next";
import { currentUser } from "@/lib/auth";
import { aiTaggedCount, archiveItAll, emailInAddress, me, tagsOf } from "@/lib/library";
import { EmailInSection } from "./EmailInSection";
import { ExpirySection } from "./ExpirySection";
import { ProfileSection } from "./ProfileSection";
import { TagsSection } from "./TagsSection";
import styles from "./settings.module.css";

export const metadata: Metadata = { title: "Settings · Pluck" };

// Settings from the board. Sections land with their slices: tags now; AI tools, email-in, keys,
// expiry, import, export and delete later.
export default async function Settings() {
  const user = (await currentUser())!;
  const [tags, aiWeek, profile, stale, address] = await Promise.all([
    tagsOf(user.id), aiTaggedCount(user.id, 7), me(user.id), archiveItAll(user.id, { dryRun: true }), emailInAddress(user.id),
  ]);
  return (
    <div className={styles.page}>
      <div className={styles.head}>
        <h1 className={styles.title}>Settings</h1>
        <span className={styles.meta}>{user.email} · signed in with an email link</span>
      </div>
      <ProfileSection initial={profile} />
      <EmailInSection initial={address} />
      <ExpirySection initial={profile.settings} staleCount={stale.count} />
      <TagsSection initial={tags} aiWeek={aiWeek} />
    </div>
  );
}
