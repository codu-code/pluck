import { App } from "aws-cdk-lib";
import { Template } from "aws-cdk-lib/assertions";
import { expect, test } from "vitest";
import { EmailStack } from "./email-stack.ts";

const template = () =>
  Template.fromStack(new EmailStack(new App(), "Email", { env: { region: "eu-west-1" }, domain: "getpluck.io" }));

test("SES domain identity with DKIM and a custom MAIL FROM", () => {
  template().hasResourceProperties("AWS::SES::EmailIdentity", {
    EmailIdentity: "getpluck.io",
    DkimSigningAttributes: { NextSigningKeyLength: "RSA_2048_BIT" },
    MailFromAttributes: { MailFromDomain: "mail.getpluck.io" },
  });
});

test("every DNS record Vercel needs is an output, and nothing touches Route53", () => {
  const t = template();
  const outputs = Object.keys(t.findOutputs("*"));
  expect(outputs.filter((o) => o.startsWith("DnsDkim"))).toHaveLength(3);
  expect(outputs).toEqual(expect.arrayContaining(["DnsMailFromMx", "DnsMailFromSpf", "DnsDmarc"]));
  expect(Object.keys(t.findResources("AWS::Route53::RecordSet"))).toHaveLength(0);
});

test("automated mail has its own subdomains, so a spam report on one never burns the root or the other", () => {
  const t = template();
  for (const host of ["notify.getpluck.io", "updates.getpluck.io"])
    t.hasResourceProperties("AWS::SES::EmailIdentity", { EmailIdentity: host, MailFromAttributes: { MailFromDomain: `mail.${host}` } });
  const outputs = Object.keys(t.findOutputs("*"));
  for (const id of ["Notify", "Updates"]) {
    expect(outputs.filter((o) => o.startsWith(`Dns${id}Dkim`))).toHaveLength(3);
    expect(outputs).toEqual(expect.arrayContaining([`Dns${id}MailFromMx`, `Dns${id}MailFromSpf`]));
  }
});
