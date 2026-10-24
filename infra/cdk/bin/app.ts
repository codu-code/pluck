import { App } from "aws-cdk-lib";
import { EmailStack } from "../lib/email-stack.ts";

const app = new App();
const domain: string = app.node.tryGetContext("domain");
const env = { account: process.env.CDK_DEFAULT_ACCOUNT, region: "eu-west-1" };

new EmailStack(app, "PluckEmail", { env, domain });
