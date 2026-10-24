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
  // Pages in windows-1252, declared in the header or only in a <meta>: "Café" must not come out as mojibake.
  const latin1 = (title) => Buffer.from(`<html><head><meta charset="windows-1252"><title>${title}</title></head><body><article><h1>${title}</h1><p>${"Un café crème à la terrasse, déjà réservé. ".repeat(20)}</p></article></body></html>`, "latin1");
  if (url.pathname === "/latin1") return res.writeHead(200, { "content-type": "text/html; charset=windows-1252" }).end(latin1("Café crème"));
  if (url.pathname === "/latin1-meta") return res.writeHead(200, { "content-type": "text/html" }).end(latin1("Déjà vu"));
  // A file name that is not valid percent-encoding (a stray %), as real sites serve them.
  if (url.pathname.startsWith("/odd/")) return res.writeHead(200, { "content-type": "application/pdf" }).end(await readFile(join(ROOT, "doc.pdf")));
  const path = normalize(join(ROOT, url.pathname === "/" ? "index.html" : url.pathname));
  if (!path.startsWith(ROOT)) return res.writeHead(403).end();
  try {
    const body = await readFile(path);
    res.writeHead(200, { "content-type": TYPES[extname(path)] ?? "application/octet-stream" }).end(body);
  } catch {
    res.writeHead(404).end("not found");
  }
}).listen(4180, "0.0.0.0");
