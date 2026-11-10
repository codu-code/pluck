import { readFileSync } from "node:fs";
import { expect, test } from "vitest";

const read = (path: string) => readFileSync(new URL(`../../../${path}`, import.meta.url), "utf8");

// server.json is Pluck's entry in the MCP registry. The registry checks it against the npm package it names, and
// nothing else here would notice the two drifting apart.
test("the registry listing names the connector, the package as it is published and the inputs its CLI reads", () => {
  const listing = JSON.parse(read("server.json"));
  const pkg = JSON.parse(read("packages/mcp-stdio/package.json"));
  const cli = read("packages/mcp-stdio/src/cli.ts");
  expect(listing.name).toBe("io.github.codu-code/pluck");
  expect(pkg.mcpName).toBe(listing.name); // how the registry knows the package is ours
  expect(listing.description.length).toBeLessThanOrEqual(100); // the registry's limit
  expect(listing.remotes).toEqual([{ type: "streamable-http", url: "https://getpluck.io/mcp" }]);
  const [npm] = listing.packages;
  expect([npm.registryType, npm.identifier, npm.version]).toEqual(["npm", pkg.name, pkg.version]);
  expect(npm.packageArguments.map((a: { name: string }) => a.name)).toEqual(["--server"]);
  expect(npm.environmentVariables.map((e: { name: string }) => e.name)).toEqual(["PLUCK_API_KEY"]);
  expect(cli).toContain('server: { type: "string" }');
  expect(cli).toContain("process.env.PLUCK_API_KEY");
  expect(cli).toContain(`"${npm.packageArguments[0].default}"`); // the server it goes to when none is given
});
