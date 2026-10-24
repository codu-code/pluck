import { verifyOAuthQueryParams } from "@better-auth/oauth-provider";
import { Logo } from "@pluck/ui";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth, currentUser, FIRST_PARTY_REDIRECTS } from "@/lib/auth";
import { ConsentButtons } from "./ConsentButtons";
import styles from "./consent.module.css";

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
  const scopes = (query.get("scope") ?? "").split(" ").filter((s) => SCOPES[s]);

  return (
    <main className={styles.page}>
      <div className={styles.card}>
        <Logo size={48} />
        {!valid ? (
          <>
            <h1 className={styles.title}>This request has expired.</h1>
            <p className={styles.meta}>Start the connection again from your AI tool.</p>
          </>
        ) : (
          <>
            <h1 className={styles.title}>{name} wants to use your Pluck</h1>
            <p className={styles.meta}>
              Signed in as {user.email}.{" "}
              {forApp ? "It plucks and organises as you, from this device." : "It acts for you, only while you use it, and every change it makes is marked by AI."}
            </p>
            {!forApp && returnsTo && (
              <p className={styles.meta}>
                Allowing sends you on to <b>{returnsTo}</b>. If you do not know that address, do not allow it.
              </p>
            )}
            <ul className={styles.scopes}>
              {scopes.map((s) => <li key={s}>{SCOPES[s]}</li>)}
            </ul>
            <p className={styles.meta}>It can never delete anything unless that is listed above. You can disconnect it in Settings.</p>
            <ConsentButtons />
          </>
        )}
      </div>
    </main>
  );
}
