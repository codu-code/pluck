import { afterEach, expect, test } from "vitest";
import { guardedFetch, isPrivateAddress } from "./fetch.ts";

afterEach(() => {
  delete process.env.ALLOW_PRIVATE_FETCH;
});

test.each(["127.0.0.1", "10.1.2.3", "172.20.0.1", "192.168.1.1", "169.254.169.254", "192.0.0.8", "240.1.2.3", "::1", "fd00::1", "::ffff:127.0.0.1", "64:ff9b::7f00:1", "2002:7f00:1::"])("%s is private", (ip) => {
  expect(isPrivateAddress(ip)).toBe(true);
});

test.each(["1.1.1.1", "8.8.8.8", "2606:4700:4700::1111"])("%s is public", (ip) => {
  expect(isPrivateAddress(ip)).toBe(false);
});

test("refuses private hosts, localhost names and non-http schemes", async () => {
  await expect(guardedFetch("http://127.0.0.1:4180/health")).rejects.toThrow(/blocked/);
  await expect(guardedFetch("http://169.254.169.254/latest/meta-data")).rejects.toThrow(/blocked/);
  await expect(guardedFetch("http://localhost:4180/health")).rejects.toThrow(/blocked/);
  await expect(guardedFetch("file:///etc/passwd")).rejects.toThrow(/unsupported/);
});

test("refuses names that resolve to private addresses", async () => {
  // localtest.me and its subdomains resolve to 127.0.0.1 in public DNS.
  await expect(guardedFetch("http://pluck.localtest.me:4180/health")).rejects.toThrow(/blocked/);
});

test("ALLOW_PRIVATE_FETCH opens the fixture server for dev and e2e", async () => {
  process.env.ALLOW_PRIVATE_FETCH = "1";
  const res = await guardedFetch("http://127.0.0.1:4180/news-1.html");
  expect(res.contentType).toContain("text/html");
  expect(res.body.toString()).toContain("Small teams ship");
});
