import { verifyOAuthQueryParams } from "@better-auth/oauth-provider";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth, currentUser, FIRST_PARTY_REDIRECTS } from "@/lib/auth";
import { ConsentButtons } from "./ConsentButtons";
import { BigMark, Dot, Standalone, standaloneStyles as s } from "@/components/Standalone";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("app.meta"))("consent"), robots: { index: false } };
}

// What each scope means, in plain words (app.consent.scopes). The only Pluck screen most connector users ever see.
const SCOPES = { "library:read": "read", "library:write": "write", "library:delete": "delete", account: "account" } as const;
const isScope = (scope: string): scope is keyof typeof SCOPES => Object.hasOwn(SCOPES, scope);

export default async function Consent({ searchParams }: { searchParams: Promise<Record<string, string | string[]>> }) {
  const params = await searchParams;
  const t = await getTranslations("app.consent");
  const query = new URLSearchParams(Object.entries(params).flatMap(([k, v]) => (Array.isArray(v) ? v.map((x) => [k, x]) : [[k, v]])));
  const user = await currentUser();
  if (!user) redirect(`/signin?${query}`);
  const { secret } = await auth.$context;
  const valid = await verifyOAuthQueryParams(query.toString(), secret);

  const clientId = query.get("client_id") ?? "";
  const res = await auth.handler(new Request(`${process.env.BETTER_AUTH_URL}/api/auth/oauth2/public-client?client_id=${encodeURIComponent(clientId)}`, { headers: await headers() }));
  const client = res.ok ? ((await res.json()) as { client_name?: string; client_uri?: string }) : null;
  // The authorize step already matched redirect_uri to the client's own list, and the query is signed.
  const redirectUri = query.get("redirect_uri") ?? "";
  const forApp = FIRST_PARTY_REDIRECTS.includes(redirectUri); // one of our own apps (the extension, iOS), not an AI tool
  const returnsTo = URL.canParse(redirectUri) ? new URL(redirectUri).host || new URL(redirectUri).protocol.replace(/:$/, "") : "";
  const fallback = clientId.startsWith("http") && URL.canParse(clientId) ? new URL(clientId).host : t("anAiTool");
  // Anyone can name a client; only our own apps get to be called Pluck here.
  const name = client?.client_name && (forApp || !/pluck/i.test(client.client_name)) ? client.client_name : fallback;
  const scopes = (query.get("scope") ?? "").split(" ").filter(isScope);

  if (!valid)
    return <Standalone art={<BigMark />} title={<>{t("expired.title")}<Dot /></>} lede={t("expired.lede")} />;

  return (
    <Standalone
      size="md"
      title={<>{t("title", { name })}<Dot /></>}
      lede={forApp ? t("appLede") : t("lede")}
      art={forApp ? <BigMark /> : (
        <div className={s.panel}>
          <div className={s.panelHead}><b>{t("art.inbox")}</b><time>{t("art.after")}</time></div>
          <div className={s.entry}><span className={s.ring} /><span className={s.entryText}><b>{t("art.one")}</b><span>{t("art.oneNote")}</span></span><span className={s.aiChip}>{t("art.byAi")}</span></div>
          <div className={s.entry}><span className={s.ring} /><span className={s.entryText}><b>{t("art.two")}</b><span>{t("art.twoNote")}</span></span><span className={s.aiChip}>{t("art.byAi")}</span></div>
          <div className={s.entry}><span className={s.ring} /><span className={s.entryText}><b>{t("art.three")}</b><span>{t("art.threeNote")}</span></span></div>
        </div>
      )}
    >
      {!forApp && returnsTo && (
        <p className={s.notice}>{t.rich("returnsTo", { host: returnsTo, b: (c) => <b>{c}</b> })}</p>
      )}
      <ul className={s.ruled}>
        {scopes.map((scope) => <li key={scope}>{t(`scopes.${SCOPES[scope]}`)}</li>)}
      </ul>
      <p className={s.small}>{t("signedInAs", { email: user.email })}</p>
      <ConsentButtons />
    </Standalone>
  );
}
