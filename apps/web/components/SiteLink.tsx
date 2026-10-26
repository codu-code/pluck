import { fromIntlLocale } from "@pluck/i18n";
import { useLocale } from "next-intl";
import Link from "next/link";
import type { ComponentProps } from "react";
import { localePath } from "@/lib/siteUrls";

// next/link that keeps a site page's link in the language you're reading (/de/connect, not /connect).
export default function SiteLink({ href, ...rest }: Omit<ComponentProps<typeof Link>, "href"> & { href: string }) {
  return <Link href={localePath(fromIntlLocale(useLocale()), href)} {...rest} />;
}
