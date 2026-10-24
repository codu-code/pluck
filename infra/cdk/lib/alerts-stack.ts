import { Duration, Stack, type StackProps } from "aws-cdk-lib";
import * as budgets from "aws-cdk-lib/aws-budgets";
import * as cloudwatch from "aws-cdk-lib/aws-cloudwatch";
import * as actions from "aws-cdk-lib/aws-cloudwatch-actions";
import * as sns from "aws-cdk-lib/aws-sns";
import * as subs from "aws-cdk-lib/aws-sns-subscriptions";
import type { Construct } from "constructs";

export type AlertsStackProps = StackProps & { alertEmail: string; monthlyBudgetUsd: number };

// Early warnings, by email. SES puts an account under review at 5% bounces or 0.1% complaints and can pause it,
// which stops every sign-in link; abused sign-in shows up here first. The budget catches any cost that runs away.
export class AlertsStack extends Stack {
  constructor(scope: Construct, id: string, props: AlertsStackProps) {
    super(scope, id, props);
    const { alertEmail, monthlyBudgetUsd } = props;

    const topic = new sns.Topic(this, "Alerts", { displayName: "Pluck alerts" });
    topic.addSubscription(new subs.EmailSubscription(alertEmail));

    const reputation = [["Bounces", "Reputation.BounceRate", 0.04], ["Complaints", "Reputation.ComplaintRate", 0.0008]] as const;
    for (const [name, metricName, threshold] of reputation) {
      new cloudwatch.Alarm(this, `Ses${name}`, {
        alarmDescription: `SES ${name.toLowerCase()} are near the rate where AWS reviews the account. Check recent sign-in links and the digest.`,
        metric: new cloudwatch.Metric({ namespace: "AWS/SES", metricName, statistic: "Maximum", period: Duration.hours(1) }),
        threshold,
        evaluationPeriods: 1,
        comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      }).addAlarmAction(new actions.SnsAction(topic));
    }

    const notify = (notificationType: "ACTUAL" | "FORECASTED", threshold: number) => ({
      notification: { notificationType, comparisonOperator: "GREATER_THAN", threshold, thresholdType: "PERCENTAGE" },
      subscribers: [{ subscriptionType: "EMAIL", address: alertEmail }],
    });
    new budgets.CfnBudget(this, "Monthly", {
      budget: { budgetName: "pluck-monthly", budgetType: "COST", timeUnit: "MONTHLY", budgetLimit: { amount: monthlyBudgetUsd, unit: "USD" } },
      notificationsWithSubscribers: [notify("ACTUAL", 80), notify("FORECASTED", 100)],
    });
  }
}
