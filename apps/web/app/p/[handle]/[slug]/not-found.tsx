import Link from "next/link";
import { Actions, BigMark, Dot, Standalone, standaloneStyles as s } from "@/components/Standalone";

// A public List link that does not open: made private, deleted, or a typo. Still a 404.
export default function ListNotFound() {
  return (
    <Standalone
      size="md"
      title={["This List", <>isn&apos;t public<Dot /></>]}
      lede="Either it no longer exists, or its owner made it private. If someone sent you the link, ask them to share it with you, or to make it public again."
      art={<BigMark />}
    >
      <Actions>
        <Link href="/" className={s.primary}>What is Pluck?</Link>
        <Link href="/lists" className={s.textLink}>Your Lists</Link>
      </Actions>
    </Standalone>
  );
}
