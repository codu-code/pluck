import { lookup as dnsLookup, type LookupAddress } from "node:dns";
import { BlockList, isIP } from "node:net";
import { Agent, fetch, type Response } from "undici";

// APIs (oEmbed, registries) are asked as ourselves, with a way to reach us; pages are read as the browser would.
export const PLUCK_UA = "Pluck/1.0 (+https://getpluck.io; support@getpluck.io)";
export const BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36";

// Never fetch our own network on a user's behalf. Checked on the URL host and again at connect time,
// so DNS answers and redirects cannot point the server at private addresses.
const blocked = new BlockList();
for (const [net, prefix] of [["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8], ["169.254.0.0", 16], ["172.16.0.0", 12], ["192.168.0.0", 16], ["198.18.0.0", 15], ["224.0.0.0", 4]] as const)
  blocked.addSubnet(net, prefix, "ipv4");
for (const [net, prefix] of [["::", 128], ["::1", 128], ["fc00::", 7], ["fe80::", 10]] as const)
  blocked.addSubnet(net, prefix, "ipv6");

export function isPrivateAddress(ip: string): boolean {
  // IPv4-mapped IPv6 (::ffff:127.0.0.1) is checked as the IPv4 address it wraps.
  const mapped = ip.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i)?.[1];
  if (mapped) return blocked.check(mapped, "ipv4");
  return blocked.check(ip, isIP(ip) === 6 ? "ipv6" : "ipv4");
}

const allowPrivate = () => process.env.ALLOW_PRIVATE_FETCH === "1";

const guardedAgent = new Agent({
  connect: {
    lookup(hostname, options, cb) {
      dnsLookup(hostname, { ...options, all: true }, (err, addresses: LookupAddress[]) => {
        if (err) return cb(err, "", 4);
        const bad = !allowPrivate() && addresses.some((a) => isPrivateAddress(a.address));
        if (bad) return cb(Object.assign(new Error(`blocked private address for ${hostname}`), { code: "EBLOCKED" }), "", 4);
        // why: Node passes `all` through from autoSelectFamily; answer in the shape it asked for.
        if ((options as { all?: boolean }).all) return (cb as unknown as (e: null, a: LookupAddress[]) => void)(null, addresses);
        cb(null, addresses[0]!.address, addresses[0]!.family);
      });
    },
  },
});

export class FetchError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
  }
}

function assertPublicUrl(url: URL) {
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new FetchError(`unsupported protocol ${url.protocol}`);
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (!allowPrivate() && (host === "localhost" || (isIP(host) && isPrivateAddress(host))))
    throw new FetchError(`blocked private address ${host}`);
}

// GET with a browser user agent, manual redirects (each hop re-checked), a timeout and a size cap.
export async function guardedFetch(
  input: string,
  { signal, maxBytes = 10_000_000, accept = "text/html,application/xhtml+xml,*/*;q=0.8", userAgent = BROWSER_UA }: { signal?: AbortSignal; maxBytes?: number; accept?: string; userAgent?: string } = {},
): Promise<{ url: string; contentType: string; body: Buffer }> {
  let url = new URL(input);
  for (let hop = 0; hop < 6; hop++) {
    assertPublicUrl(url);
    let res: Response;
    try {
      res = await fetch(url, { dispatcher: guardedAgent, redirect: "manual", signal, headers: { "user-agent": userAgent, accept } });
    } catch (e) {
      throw new FetchError(e instanceof Error ? (e.cause instanceof Error ? e.cause.message : e.message) : String(e));
    }
    if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
      url = new URL(res.headers.get("location")!, url);
      await res.body?.cancel();
      continue;
    }
    if (!res.ok) {
      await res.body?.cancel();
      throw new FetchError(`HTTP ${res.status}`, res.status);
    }
    const chunks: Buffer[] = [];
    let size = 0;
    for await (const chunk of res.body ?? []) {
      size += chunk.length;
      if (size > maxBytes) throw new FetchError(`response over ${maxBytes} bytes`);
      chunks.push(Buffer.from(chunk));
    }
    return { url: url.toString(), contentType: res.headers.get("content-type") ?? "", body: Buffer.concat(chunks) };
  }
  throw new FetchError("too many redirects");
}
