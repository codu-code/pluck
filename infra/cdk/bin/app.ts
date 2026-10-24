import { App } from "aws-cdk-lib";
import { AlertsStack } from "../lib/alerts-stack.ts";
import { DataStack } from "../lib/data-stack.ts";
import { EmailStack } from "../lib/email-stack.ts";
import { InboundStack } from "../lib/inbound-stack.ts";

const app = new App();
const domain: string = app.node.tryGetContext("domain");
const env = { account: process.env.CDK_DEFAULT_ACCOUNT, region: "eu-west-1" };

const email = new EmailStack(app, "PluckEmail", { env, domain });
const data = new DataStack(app, "PluckData", { env, emailIdentity: email.identity, appOrigin: app.node.tryGetContext("appOrigin") });
new InboundStack(app, "PluckInbound", { env, domain, bucket: data.bucket });

// Where alerts go is a deploy-time choice, not something to keep in a public repo: `-c alertEmail=you@example.com`.
const alertEmail: string | undefined = app.node.tryGetContext("alertEmail");
if (!alertEmail) throw new Error("Pass -c alertEmail=<address> so the SES and budget alarms reach someone.");
new AlertsStack(app, "PluckAlerts", { env, alertEmail, monthlyBudgetUsd: Number(app.node.tryGetContext("monthlyBudgetUsd") ?? 50) });
