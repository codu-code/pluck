import Link from "next/link";
import { Actions, BigMark, Dot, Standalone, standaloneStyles as s } from "@/components/Standalone";

// Public pages that are private now, gone, or never were; and any address that is not a page.
export default function NotFound() {
  return (
    <Standalone title={<>Nothing here<Dot /></>} lede="It may be private now, or it never was." art={<BigMark />}>
      <Actions>
        <Link href="/" className={s.primary}>Go to Pluck</Link>
        <Link href="/support" className={s.textLink}>Support</Link>
      </Actions>
    </Standalone>
  );
}
