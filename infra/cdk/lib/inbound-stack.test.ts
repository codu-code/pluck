import { App } from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";
import { expect, test } from "vitest";
import { DataStack } from "./data-stack.ts";
import { EmailStack } from "./email-stack.ts";
import { InboundStack } from "./inbound-stack.ts";

function stacks() {
  const app = new App();
  const env = { account: "123456789012", region: "eu-west-1" };
  const email = new EmailStack(app, "Email", { env, domain: "getpluck.io" });
  const data = new DataStack(app, "Data", { env, emailIdentity: email.identity, appOrigin: "https://getpluck.io" });
  const inbound = new InboundStack(app, "Inbound", { env, domain: "getpluck.io", bucket: data.bucket });
  return { inbound: Template.fromStack(inbound), data: Template.fromStack(data) };
}

test("mail for in.getpluck.io is scanned and written to the bucket under inbound/", () => {
  const { inbound } = stacks();
  inbound.hasResourceProperties("AWS::SES::ReceiptRule", {
    Rule: {
      Recipients: ["in.getpluck.io"],
      ScanEnabled: true,
      Enabled: true,
      Actions: [{ S3Action: Match.objectLike({ ObjectKeyPrefix: "inbound/" }) }],
    },
  });
  expect(Object.keys(inbound.findOutputs("*"))).toEqual(expect.arrayContaining(["DnsInboundMx", "ActivateRuleSet"]));
});

test("SES may write to the bucket, and unprocessed inbound mail expires after a week", () => {
  const { data } = stacks();
  data.hasResourceProperties("AWS::S3::BucketPolicy", {
    PolicyDocument: { Statement: Match.arrayWith([Match.objectLike({ Principal: { Service: "ses.amazonaws.com" }, Action: "s3:PutObject" })]) },
  });
  data.hasResourceProperties("AWS::S3::Bucket", {
    LifecycleConfiguration: { Rules: Match.arrayWith([Match.objectLike({ Prefix: "inbound/", ExpirationInDays: 7 })]) },
  });
});
