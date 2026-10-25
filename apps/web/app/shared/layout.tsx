import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";

// The app catalog for this route's client components (the root layout sends only the site's).
export default function Layout({ children }: { children: ReactNode }) {
  return <NextIntlClientProvider>{children}</NextIntlClientProvider>;
}
