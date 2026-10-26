// Before an upload: which version this is. Shows what App Store Connect last had and asks Keep, Patch (fixes), Minor
// (features) or Major, then writes the answer into app.config.ts. Run by testflight.sh, or alone:
// node scripts/release.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { createInterface } from "node:readline/promises";
import { nextBuild, uploadedVersions } from "./asc.mjs";
import { bump, compare, newest } from "./version.mjs";

const CONFIG = new URL("../app.config.ts", import.meta.url);
const source = readFileSync(CONFIG, "utf8");
const VERSION = /^(\s*version: ")(\d+\.\d+\.\d+)(")/m;
const current = VERSION.exec(source)?.[2];
if (!current) throw new Error("No version in app.config.ts");

const shipped = newest(await uploadedVersions());
const build = await nextBuild();
// Not uploaded yet: this release can go as it is. Already uploaded: it needs a higher number (a new build of the same
// version is allowed by Apple, but then testers see no change in the number).
const fresh = shipped === null || compare(current, shipped) > 0;
const base = fresh ? (shipped ?? current) : current;
const choices = [
  ...(fresh ? [{ key: "k", label: "Keep", version: current, why: "not uploaded yet" }] : [{ key: "k", label: "Keep", version: current, why: "same version again, a new build" }]),
  { key: "p", label: "Patch", version: bump(base, "patch"), why: "fixes only" },
  { key: "m", label: "Minor", version: bump(base, "minor"), why: "new features" },
  { key: "M", label: "Major", version: bump(base, "major"), why: "a big change" },
].filter((c, i, all) => all.findIndex((d) => d.version === c.version) === i); // Keep may already be the patch or minor

console.log(`\nLast uploaded: ${shipped ?? "nothing yet"}. In app.config.ts: ${current}. This upload's build number: ${build}.\n`);
for (const c of choices) console.log(`  ${c.key}  ${c.label.padEnd(6)} ${c.version.padEnd(8)} ${c.why}`);
const rl = createInterface({ input: process.stdin, output: process.stdout });
const answer = (await rl.question(`\nWhich one? [${choices[0].key}] `)).trim() || choices[0].key;
rl.close();
const pick = choices.find((c) => c.key === answer) ?? choices.find((c) => c.key.toLowerCase() === answer.toLowerCase());
if (!pick) throw new Error(`"${answer}" is not one of ${choices.map((c) => c.key).join(", ")}`);

if (pick.version !== current) {
  writeFileSync(CONFIG, source.replace(VERSION, `$1${pick.version}$3`));
  console.log(`\napp.config.ts now says ${pick.version}. Commit it as "Release ${pick.version}" so main matches what shipped.`);
}
console.log(`Uploading ${pick.version} (${build}).\n`);
