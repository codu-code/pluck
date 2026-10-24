import type { Metadata } from "next";
import { Fragment } from "react";
import { Dot, Standalone, standaloneStyles as s } from "@/components/Standalone";

export const metadata: Metadata = { title: "Connected · Pluck", robots: { index: false } };

const Keys = ({ keys }: { keys: string[] }) => (
  <span className={s.keys}>
    {keys.map((k, i) => (
      <Fragment key={k}>
        {i > 0 && <span className={s.keyPlus} aria-hidden="true">+</span>}
        <kbd className={s.key}>{k}</kbd>
      </Fragment>
    ))}
  </span>
);

// Where the extension's sign-in ends. The extension reads the code from this tab's address (it holds the
// PKCE verifier, so the code is useless to anyone else) and closes the tab.
export default function Connected() {
  return (
    <Standalone
      title={<>Connected<Dot /></>}
      lede="You can pluck from your browser now. Close this tab; from here on, any page is one press away."
      artIsContent
      art={
        <div className={s.keyArt}>
          <div className={s.keyRow}>
            <Keys keys={["Alt", "Shift", "P"]} />
            <p className={s.keyNote}>Plucks the page you are on. Alt is Option on a Mac.</p>
          </div>
          <div className={s.keyRow}>
            <Keys keys={["Alt", "Shift", "H"]} />
            <p className={s.keyNote}>Plucks what you selected, kept as a highlight.</p>
          </div>
        </div>
      }
    />
  );
}
