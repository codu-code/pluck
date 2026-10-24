import Link from "next/link";
import { Actions, Dot, Standalone, standaloneStyles as s } from "@/components/Standalone";
import { Retry } from "./Retry";

export const dynamic = "force-static";

// What the app shows when it is opened with no connection (the service worker serves this page).
export default function Offline() {
  return (
    <Standalone
      title={["Offline.", <>Not lost<Dot /></>]}
      lede="Pages you opened lately are still here, and anything you pluck now waits on this device until you are back."
      art={
        <div className={s.panel}>
          <div className={s.panelHead}><b>Inbox</b><time>2 waiting</time></div>
          <div className={s.entry}><span className={s.dotClay} /><span className={s.entryText}><b>The article from the train</b><span>Waits here, goes up when you are back</span></span></div>
          <div className={s.entry}><span className={s.dotClay} /><span className={s.entryText}><b>Buy an induction hob</b><span>Todo, waits here too</span></span></div>
          <div className={s.entry}><span className={s.ring} /><span className={s.entryText}><b>Postgres indexes in 40 minutes</b><span>Opened yesterday, still readable</span></span></div>
        </div>
      }
    >
      <Actions>
        <Retry />
        <Link href="/inbox" className={s.textLink}>Open the Inbox</Link>
      </Actions>
    </Standalone>
  );
}
