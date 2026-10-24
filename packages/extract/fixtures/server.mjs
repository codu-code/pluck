// Fixture server for extraction tests and demos. Static pages plus a few misbehaving routes.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";

const ROOT = join(import.meta.dirname, "pages");
const TYPES = { ".html": "text/html; charset=utf-8", ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml", ".pdf": "application/pdf", ".json": "application/json" };

createServer(async (req, res) => {
  const url = new URL(req.url, "http://x");
  if (url.pathname === "/health") return res.end("ok");
  if (url.pathname === "/slow") return setTimeout(() => res.end("<title>Too slow</title>"), 8000);
  if (url.pathname === "/error") return res.writeHead(500).end("boom");
  if (url.pathname === "/flaky") {
    // Fails the first request for each `n`, then serves a page: exercises the retry queue.
    const n = url.searchParams.get("n") ?? "0";
    globalThis.seen ??= new Set();
    if (!globalThis.seen.has(n)) { globalThis.seen.add(n); return res.writeHead(503).end("try later"); }
    return res.writeHead(200, { "content-type": TYPES[".html"] }).end(`<html><head><title>Back on its feet ${n}</title></head><body><article><h1>Back on its feet</h1><p>${"This page failed once and then worked. ".repeat(20)}</p></article></body></html>`);
  }
  const path = normalize(join(ROOT, url.pathname === "/" ? "index.html" : url.pathname));
  if (!path.startsWith(ROOT)) return res.writeHead(403).end();
  try {
    const body = await readFile(path);
    res.writeHead(200, { "content-type": TYPES[extname(path)] ?? "application/octet-stream" }).end(body);
  } catch {
    res.writeHead(404).end("not found");
  }
}).listen(4180, "0.0.0.0");
