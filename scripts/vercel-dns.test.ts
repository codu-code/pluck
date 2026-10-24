import { expect, test } from "vitest";
import { commandsFor } from "./vercel-dns.mjs";

test("CDK DNS outputs become vercel dns add commands", () => {
  const outputs = {
    PluckEmail: {
      DnsDkim1: "CNAME abc._domainkey.getpluck.io abc.dkim.amazonses.com",
      DnsMailFromMx: "MX mail.getpluck.io 10 feedback-smtp.eu-west-1.amazonses.com",
      DnsMailFromSpf: 'TXT mail.getpluck.io "v=spf1 include:amazonses.com ~all"',
      DnsDmarc: 'TXT _dmarc.getpluck.io "v=DMARC1; p=none;"',
      SomethingElse: "ignored",
    },
    PluckInbound: { DnsInboundMx: "MX in.getpluck.io 10 inbound-smtp.eu-west-1.amazonaws.com" },
  };
  expect(commandsFor(outputs, "getpluck.io")).toEqual([
    ["dns", "add", "getpluck.io", "abc._domainkey", "CNAME", "abc.dkim.amazonses.com"],
    ["dns", "add", "getpluck.io", "mail", "MX", "feedback-smtp.eu-west-1.amazonses.com", "10"],
    ["dns", "add", "getpluck.io", "mail", "TXT", "v=spf1 include:amazonses.com ~all"],
    ["dns", "add", "getpluck.io", "_dmarc", "TXT", "v=DMARC1; p=none;"],
    ["dns", "add", "getpluck.io", "in", "MX", "inbound-smtp.eu-west-1.amazonaws.com", "10"],
  ]);
  expect(() => commandsFor({ S: { DnsX: "TXT other.example x" } }, "getpluck.io")).toThrow("not under");
});
