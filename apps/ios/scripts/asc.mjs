// App Store Connect, read with the API key: the build numbers and versions already uploaded. Reads ASC_KEY_ID,
// ASC_ISSUER_ID, ASC_KEY_PATH and ASC_APP_ID (the deployment folder's asc.env has them).
import { createPrivateKey, sign } from "node:crypto";
import { readFileSync } from "node:fs";

const { ASC_KEY_ID, ASC_ISSUER_ID, ASC_KEY_PATH, ASC_APP_ID } = process.env;

function token() {
  if (!ASC_KEY_ID || !ASC_ISSUER_ID || !ASC_KEY_PATH || !ASC_APP_ID) throw new Error("set ASC_KEY_ID, ASC_ISSUER_ID, ASC_KEY_PATH and ASC_APP_ID");
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const now = Math.floor(Date.now() / 1000);
  const unsigned = `${b64({ alg: "ES256", kid: ASC_KEY_ID, typ: "JWT" })}.${b64({ iss: ASC_ISSUER_ID, iat: now, exp: now + 600, aud: "appstoreconnect-v1" })}`;
  return `${unsigned}.${sign("sha256", Buffer.from(unsigned), { key: createPrivateKey(readFileSync(ASC_KEY_PATH)), dsaEncoding: "ieee-p1363" }).toString("base64url")}`;
}

// Every row of a list, following its pages.
async function all(path) {
  const jwt = token();
  const rows = [];
  for (let url = `https://api.appstoreconnect.apple.com${path}`; url; ) {
    const res = await fetch(url, { headers: { authorization: `Bearer ${jwt}` } });
    if (!res.ok) throw new Error(`App Store Connect said ${res.status}: ${(await res.text()).slice(0, 300)}`);
    const page = await res.json();
    rows.push(...page.data);
    url = page.links?.next;
  }
  return rows;
}

// One more than the highest build number uploaded, for any version.
export async function nextBuild() {
  const builds = await all(`/v1/builds?filter[app]=${ASC_APP_ID}&fields[builds]=version&limit=200`);
  return Math.max(0, ...builds.map((b) => Number.parseInt(b.attributes.version, 10) || 0)) + 1;
}

// Every version uploaded, to TestFlight or the App Store.
export async function uploadedVersions() {
  const [beta, store] = await Promise.all([
    all(`/v1/preReleaseVersions?filter[app]=${ASC_APP_ID}&fields[preReleaseVersions]=version&limit=200`),
    all(`/v1/apps/${ASC_APP_ID}/appStoreVersions?fields[appStoreVersions]=versionString&limit=200`),
  ]);
  return [...beta.map((v) => v.attributes.version), ...store.map((v) => v.attributes.versionString)];
}
