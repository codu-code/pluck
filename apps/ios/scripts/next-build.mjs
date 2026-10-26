// The next build number for an upload: one more than the highest App Store Connect has for the app, any version.
// Reads ASC_KEY_ID, ASC_ISSUER_ID, ASC_KEY_PATH and ASC_APP_ID; prints the number. Usage: node scripts/next-build.mjs
import { createPrivateKey, sign } from "node:crypto";
import { readFileSync } from "node:fs";

const { ASC_KEY_ID, ASC_ISSUER_ID, ASC_KEY_PATH, ASC_APP_ID } = process.env;
if (!ASC_KEY_ID || !ASC_ISSUER_ID || !ASC_KEY_PATH || !ASC_APP_ID) throw new Error("set ASC_KEY_ID, ASC_ISSUER_ID, ASC_KEY_PATH and ASC_APP_ID");
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const now = Math.floor(Date.now() / 1000);
const unsigned = `${b64({ alg: "ES256", kid: ASC_KEY_ID, typ: "JWT" })}.${b64({ iss: ASC_ISSUER_ID, iat: now, exp: now + 600, aud: "appstoreconnect-v1" })}`;
const jwt = `${unsigned}.${sign("sha256", Buffer.from(unsigned), { key: createPrivateKey(readFileSync(ASC_KEY_PATH)), dsaEncoding: "ieee-p1363" }).toString("base64url")}`;

let highest = 0;
for (let url = `https://api.appstoreconnect.apple.com/v1/builds?filter[app]=${ASC_APP_ID}&fields[builds]=version&limit=200`; url; ) {
  const res = await fetch(url, { headers: { authorization: `Bearer ${jwt}` } });
  if (!res.ok) throw new Error(`App Store Connect said ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const page = await res.json();
  for (const b of page.data) highest = Math.max(highest, Number.parseInt(b.attributes.version, 10) || 0);
  url = page.links?.next;
}
console.log(highest + 1);
