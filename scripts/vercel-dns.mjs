// Turns the CDK stacks' DNS outputs into `vercel dns add` commands for a domain whose DNS is on Vercel.
// Usage, after `cdk deploy --all --outputs-file cdk-outputs.json` in infra/cdk:
//   node scripts/vercel-dns.mjs infra/cdk/cdk-outputs.json getpluck.io           # prints the commands
//   node scripts/vercel-dns.mjs infra/cdk/cdk-outputs.json getpluck.io --apply   # runs them with your Vercel login
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// Every output whose key starts with "Dns" is "<TYPE> <fqdn> <value…>" (MX values start with the priority).
export function commandsFor(outputs, domain) {
  const out = [];
  for (const stack of Object.values(outputs)) {
    for (const [key, raw] of Object.entries(stack)) {
      if (!key.startsWith("Dns")) continue;
      const [type, fqdn, ...rest] = String(raw).split(" ");
      if (!fqdn.endsWith(domain)) throw new Error(`${key}: ${fqdn} is not under ${domain}`);
      const name = fqdn === domain ? "" : fqdn.slice(0, -(domain.length + 1));
      if (type === "MX") out.push(["dns", "add", domain, name, "MX", rest[1], rest[0]]);
      else out.push(["dns", "add", domain, name, type, rest.join(" ").replace(/^"|"$/g, "")]);
    }
  }
  return out;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [file, domain, flag] = process.argv.slice(2);
  if (!file || !domain) {
    console.error("Usage: node scripts/vercel-dns.mjs <cdk-outputs.json> <domain> [--apply]");
    process.exit(1);
  }
  for (const args of commandsFor(JSON.parse(readFileSync(file, "utf8")), domain)) {
    console.log(["vercel", ...args.map((a) => (/\s|"/.test(a) ? JSON.stringify(a) : a))].join(" "));
    if (flag === "--apply") execFileSync("vercel", args, { stdio: "inherit" });
  }
}
