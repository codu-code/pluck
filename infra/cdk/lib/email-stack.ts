import { CfnOutput, Stack, type StackProps } from "aws-cdk-lib";
import * as ses from "aws-cdk-lib/aws-ses";
import type { Construct } from "constructs";

export type EmailStackProps = StackProps & { domain: string };

// The subdomains automated mail goes from, each with its own reputation: if people mark the Monday email as spam,
// sign-in links (notify) and the root domain (people's own mail, the welcome) are not burned with it.
export const SENDERS = [["Notify", "notify"], ["Updates", "updates"]] as const;

// SES for magic links, the digest and report alerts. DNS lives in Vercel, so the records are outputs, not resources.
export class EmailStack extends Stack {
  readonly identity: ses.EmailIdentity;
  readonly identities: ses.EmailIdentity[];

  constructor(scope: Construct, id: string, props: EmailStackProps) {
    super(scope, id, props);
    const { domain } = props;
    const mailFrom = `mail.${domain}`;

    this.identity = new ses.EmailIdentity(this, "Domain", {
      identity: ses.Identity.domain(domain),
      mailFromDomain: mailFrom,
      dkimSigning: true,
      dkimIdentity: ses.DkimIdentity.easyDkim(ses.EasyDkimSigningKeyLength.RSA_2048_BIT),
    });

    // One output per DNS record, in "TYPE name value" form; docs/deploy.md feeds them to `vercel dns add`.
    this.identity.dkimRecords.forEach((r, i) => {
      new CfnOutput(this, `DnsDkim${i + 1}`, { value: `CNAME ${r.name} ${r.value}` });
    });
    new CfnOutput(this, "DnsMailFromMx", { value: `MX ${mailFrom} 10 feedback-smtp.${this.region}.amazonses.com` });
    new CfnOutput(this, "DnsMailFromSpf", { value: `TXT ${mailFrom} "v=spf1 include:amazonses.com ~all"` });
    new CfnOutput(this, "DnsDmarc", { value: `TXT _dmarc.${domain} "v=DMARC1; p=none;"` });

    // Subdomains inherit the root's DMARC policy, so each needs only DKIM and its own MAIL FROM.
    this.identities = [this.identity];
    for (const [id, sub] of SENDERS) {
      const host = `${sub}.${domain}`;
      const senderMailFrom = `mail.${host}`;
      const identity = new ses.EmailIdentity(this, id, {
        identity: ses.Identity.domain(host),
        mailFromDomain: senderMailFrom,
        dkimSigning: true,
        dkimIdentity: ses.DkimIdentity.easyDkim(ses.EasyDkimSigningKeyLength.RSA_2048_BIT),
      });
      identity.dkimRecords.forEach((r, i) => new CfnOutput(this, `Dns${id}Dkim${i + 1}`, { value: `CNAME ${r.name} ${r.value}` }));
      new CfnOutput(this, `Dns${id}MailFromMx`, { value: `MX ${senderMailFrom} 10 feedback-smtp.${this.region}.amazonses.com` });
      new CfnOutput(this, `Dns${id}MailFromSpf`, { value: `TXT ${senderMailFrom} "v=spf1 include:amazonses.com ~all"` });
      this.identities.push(identity);
    }
  }
}
