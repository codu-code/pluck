import { CfnOutput, Stack, type StackProps } from "aws-cdk-lib";
import type * as s3 from "aws-cdk-lib/aws-s3";
import * as ses from "aws-cdk-lib/aws-ses";
import * as actions from "aws-cdk-lib/aws-ses-actions";
import type { Construct } from "constructs";

export type InboundStackProps = StackProps & { domain: string; bucket: s3.IBucket };

// Email-in: SES receives mail for in.<domain>, scans it, and writes the raw message to the content bucket
// under inbound/. The app polls that prefix (no Lambda, no queue). Its own stack, so neither DataStack
// nor EmailStack has to depend on the other.
export class InboundStack extends Stack {
  constructor(scope: Construct, id: string, props: InboundStackProps) {
    super(scope, id, props);
    const inbound = `in.${props.domain}`;
    const ruleSet = new ses.ReceiptRuleSet(this, "RuleSet", { receiptRuleSetName: "pluck-inbound" });
    ruleSet.addRule("ToBucket", {
      recipients: [inbound],
      scanEnabled: true,
      actions: [new actions.S3({ bucket: props.bucket, objectKeyPrefix: "inbound/" })],
    });
    new CfnOutput(this, "DnsInboundMx", { value: `MX ${inbound} 10 inbound-smtp.${this.region}.amazonaws.com` });
    // CloudFormation cannot make a rule set active; docs/deploy.md has the one command.
    new CfnOutput(this, "ActivateRuleSet", { value: `aws ses set-active-receipt-rule-set --rule-set-name pluck-inbound --region ${this.region}` });
  }
}
