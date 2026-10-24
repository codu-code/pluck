import { App } from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";
import { expect, test } from "vitest";
import { DataStack } from "./data-stack.ts";
import { EmailStack } from "./email-stack.ts";

function template() {
  const app = new App();
  const env = { account: "123456789012", region: "eu-west-1" };
  const email = new EmailStack(app, "Email", { env, domain: "getpluck.io" });
  return Template.fromStack(new DataStack(app, "Data", { env, emailIdentity: email.identity, appOrigin: "https://getpluck.io" }));
}

test("the content bucket is private, encrypted, SSL only, retained, and moves to IA at 90 days", () => {
  const t = template();
  t.hasResourceProperties("AWS::S3::Bucket", {
    BucketName: "pluck-content-123456789012",
    PublicAccessBlockConfiguration: { BlockPublicAcls: true, BlockPublicPolicy: true, IgnorePublicAcls: true, RestrictPublicBuckets: true },
    BucketEncryption: { ServerSideEncryptionConfiguration: [{ ServerSideEncryptionByDefault: { SSEAlgorithm: "AES256" } }] },
    LifecycleConfiguration: { Rules: Match.arrayWith([Match.objectLike({ Transitions: [{ StorageClass: "STANDARD_IA", TransitionInDays: 90 }] })]) },
  });
  t.hasResource("AWS::S3::Bucket", { DeletionPolicy: "Retain" });
  t.hasResourceProperties("AWS::S3::BucketPolicy", {
    PolicyDocument: { Statement: Match.arrayWith([Match.objectLike({ Effect: "Deny", Condition: { Bool: { "aws:SecureTransport": "false" } } })]) },
  });
});

test("the app user can use the bucket and send email, and its secret key is never an output", () => {
  const t = template();
  const policies = JSON.stringify(t.findResources("AWS::IAM::Policy"));
  expect(policies).toContain("s3:PutObject");
  expect(policies).toContain("s3:DeleteObject");
  expect(policies).toContain("ses:SendEmail");
  t.resourceCountIs("AWS::SecretsManager::Secret", 1);
  expect(JSON.stringify(t.findOutputs("*"))).not.toContain("SecretAccessKey");
});

test("only the app may PUT uploads to the bucket from a browser", () => {
  template().hasResourceProperties("AWS::S3::Bucket", {
    CorsConfiguration: { CorsRules: [{ AllowedMethods: ["PUT"], AllowedOrigins: ["https://getpluck.io"], AllowedHeaders: ["content-type"], MaxAge: 3000 }] },
  });
});
