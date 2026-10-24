import type { Metadata } from "next";
import { requireUser, MCP_RESOURCE } from "@/lib/auth";
import { aiTaggedCount, aiToolsOf, archiveItAll, emailInAddress, keysOf, me, tagsOf } from "@/lib/library";
import { DeleteAccount, ImportExport, KeysSection, SignOut } from "./AccountSections";
import { AiToolsSection } from "./AiToolsSection";
import { EmailInSection } from "./EmailInSection";
import { ExpirySection } from "./ExpirySection";
import { ProfileSection } from "./ProfileSection";
import { TagsSection } from "./TagsSection";
import styles from "./settings.module.css";

export const metadata: Metadata = { title: "Settings · Pluck" };

// Settings from the board, top to bottom.
export default async function Settings() {
  const user = await requireUser();
  const [tags, aiWeek, profile, stale, address, keys, aiTools] = await Promise.all([
    tagsOf(user.id), aiTaggedCount(user.id, 7), me(user.id), archiveItAll(user.id, { dryRun: true }), emailInAddress(user.id), keysOf(user.id),
    aiToolsOf(user.id),
  ]);
  return (
    <div className={styles.page}>
      <div className={styles.head}>
        <h1 className={styles.title}>Settings</h1>
        <span className={styles.meta}>
          {user.email} · signed in with an email link · <SignOut />
        </span>
      </div>
      <ProfileSection initial={profile} />
      <AiToolsSection connectorUrl={MCP_RESOURCE} keyPrefix={keys[0]?.prefix ?? null} initial={aiTools} lastCallAt={profile.lastMcpCallAt} />
      <div className={styles.pair}>
        <EmailInSection initial={address} />
        <KeysSection initial={keys} />
      </div>
      <ExpirySection initial={profile.settings} staleCount={stale.count} />
      <TagsSection initial={tags} aiWeek={aiWeek} />
      <ImportExport initialImport={null} />
      <DeleteAccount email={user.email} />
    </div>
  );
}
