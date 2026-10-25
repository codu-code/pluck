import { App } from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";
import { test } from "vitest";
import { AlertsStack } from "./alerts-stack.ts";

const template = (monthlyBudgetUsd = 50) =>
  Template.fromStack(new AlertsStack(new App(), "Alerts", { env: { region: "eu-west-1" }, alertEmail: "ops@example.test", monthlyBudgetUsd }));

test("SES bounce and complaint rates alarm to the alert email before AWS reviews the account", () => {
  const t = template();
  t.hasResourceProperties("AWS::SNS::Subscription", { Protocol: "email", Endpoint: "ops@example.test" });
  t.hasResourceProperties("AWS::CloudWatch::Alarm", { Namespace: "AWS/SES", MetricName: "Reputation.BounceRate", Threshold: 0.04, AlarmActions: Match.anyValue() });
  t.hasResourceProperties("AWS::CloudWatch::Alarm", { Namespace: "AWS/SES", MetricName: "Reputation.ComplaintRate", Threshold: 0.0008, AlarmActions: Match.anyValue() });
});

test("a monthly cost budget warns at 80% spent and at a forecast over 100%", () => {
  template().hasResourceProperties("AWS::Budgets::Budget", {
    Budget: { BudgetType: "COST", TimeUnit: "MONTHLY", BudgetLimit: { Amount: 50, Unit: "USD" } },
    NotificationsWithSubscribers: [
      { Notification: { NotificationType: "ACTUAL", Threshold: 80 }, Subscribers: [{ SubscriptionType: "EMAIL", Address: "ops@example.test" }] },
      { Notification: { NotificationType: "FORECASTED", Threshold: 100 }, Subscribers: [{ SubscriptionType: "EMAIL", Address: "ops@example.test" }] },
    ],
  });
});

test("a budget of 0 leaves the budget out, for an account whose payer holds budgets", () => {
  const t = template(0);
  t.resourceCountIs("AWS::Budgets::Budget", 0);
  t.resourceCountIs("AWS::CloudWatch::Alarm", 2);
});
