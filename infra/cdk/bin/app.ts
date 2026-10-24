import { App } from "aws-cdk-lib";
import { DataStack } from "../lib/data-stack.ts";
import { EmailStack } from "../lib/email-stack.ts";
import { InboundStack } from "../lib/inbound-stack.ts";

const app = new App();
const domain: string = app.node.tryGetContext("domain");
const env = { account: process.env.CDK_DEFAULT_ACCOUNT, region: "eu-west-1" };

const email = new EmailStack(app, "PluckEmail", { env, domain });
const data = new DataStack(app, "PluckData", { env, emailIdentity: email.identity });
new InboundStack(app, "PluckInbound", { env, domain, bucket: data.bucket });
