// Serves the e2e design snapshots and runs the impeccable detector on them in a real browser
// (file scans skip the layout rules and report false positives). Run after `pnpm e2e`.
import { spawn } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { createServer } from "node:http";
import { join } from "node:path";

const dir = "test-results/design";
const files = readdirSync(dir).filter((f) => f.endsWith(".html"));
if (!files.length) {
  console.error("No snapshots in test-results/design. Run `pnpm e2e` first.");
  process.exit(1);
}
const server = createServer((req, res) => {
  let body;
  try {
    body = readFileSync(join(dir, new URL(req.url, "http://x").pathname));
  } catch {
    return res.writeHead(404).end();
  }
  res.writeHead(200, { "content-type": "text/html" }).end(body);
}).listen(0, "127.0.0.1", async () => {
  const { port } = server.address();
  const urls = files.map((f) => `http://127.0.0.1:${port}/${f}`);
  for (const viewport of ["1280x800", "390x844"]) {
    console.log(`\n# viewport ${viewport}`);
    // Async on purpose: the detector loads pages from this process's server.
    const code = await new Promise((done) => spawn("impeccable", ["detect", "--viewport", viewport, ...urls], { stdio: "inherit" }).on("exit", done));
    if (code !== 0) process.exitCode = code ?? 1;
  }
  server.close();
});
