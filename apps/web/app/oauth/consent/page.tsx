import { verifyOAuthQueryParams } from "@better-auth/oauth-provider";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth, currentUser, FIRST_PARTY_REDIRECTS } from "@/lib/auth";
import { ConsentButtons } from "./ConsentButtons";
import { BigMark, Dot, Standalone, standaloneStyles as s } from "@/components/Standalone";

export const metadata: Metadata = { title: "Connect your AI · Pluck", robots: { index: false } };

// What each scope means, in plain words. The only Pluck screen most connector users ever see.
const SCOPES: Record<string, string> = {
  "library:read": "Read your library: items, the text Pluck kept, notes, tags and lists",
  "library:write": "Pluck and organise: save things, tag, sort, make and edit lists",
  "library:delete": "Delete items. Most AI tools never need this.",
};

export default async function Consent({ searchParams }: { searchParams: Promise<Record<string, string | string[]>> }) {
  const params = await searchParams;
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
  const fallback = clientId.startsWith("http") && URL.canParse(clientId) ? new URL(clientId).host : "An AI tool";
  // Anyone can name a client; only our own apps get to be called Pluck here.
  const name = client?.client_name && (forApp || !/pluck/i.test(client.client_name)) ? client.client_name : fallback;
  const scopes = (query.get("scope") ?? "").split(" ").filter((scope) => SCOPES[scope]);

  if (!valid)
    return <Standalone art={<BigMark />} title={<>This request has expired<Dot /></>} lede="Start the connection again from your AI tool. Nothing was shared." />;

  return (
    <Standalone
      size="md"
      title={<>{name} wants to use your Pluck<Dot /></>}
      lede={forApp ? "It plucks and organises as you, from this device." : "It acts for you, only while you use it, and every change it makes is marked by AI."}
      art={forApp ? <BigMark /> : (
        <div className={s.panel}>
          <div className={s.panelHead}><b>Inbox</b><time>after you ask it to tidy</time></div>
          <div className={s.entry}><span className={s.ring} /><span className={s.entryText}><b>How MCP auth actually works</b><span>Tagged mcp, auth</span></span><span className={s.aiChip}>by AI</span></div>
          <div className={s.entry}><span className={s.ring} /><span className={s.entryText}><b>Postgres indexes in 40 minutes</b><span>Moved to Later</span></span><span className={s.aiChip}>by AI</span></div>
          <div className={s.entry}><span className={s.ring} /><span className={s.entryText}><b>A kitchen plan in three drafts</b><span>Left as it was</span></span></div>
        </div>
      )}
    >
      {!forApp && returnsTo && (
        <p className={s.notice}>Allowing sends you on to <b>{returnsTo}</b>. If you do not know that address, do not allow it.</p>
      )}
      <ul className={s.ruled}>
        {scopes.map((scope) => <li key={scope}>{SCOPES[scope]}</li>)}
      </ul>
      <p className={s.small}>Signed in as {user.email}. It can never delete anything unless that is listed above, and you can disconnect it in Settings.</p>
      <ConsentButtons />
    </Standalone>
  );
}
