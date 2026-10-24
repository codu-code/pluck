import { CfnOutput, Duration, RemovalPolicy, SecretValue, Stack, type StackProps } from "aws-cdk-lib";
import * as iam from "aws-cdk-lib/aws-iam";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as secrets from "aws-cdk-lib/aws-secretsmanager";
import type * as ses from "aws-cdk-lib/aws-ses";
import type { Construct } from "constructs";

export type DataStackProps = StackProps & { emailIdentity: ses.IEmailIdentity; appOrigin: string };

// The content bucket and the IAM user the app (on Vercel) uses for S3 and SES.
export class DataStack extends Stack {
  readonly bucket: s3.Bucket;

  constructor(scope: Construct, id: string, props: DataStackProps) {
    super(scope, id, props);

    this.bucket = new s3.Bucket(this, "Content", {
      bucketName: `pluck-content-${this.account}`,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      removalPolicy: RemovalPolicy.RETAIN,
      // Imports upload straight from the browser with a signed PUT (bigger than a request body allows).
      cors: [{ allowedMethods: [s3.HttpMethods.PUT], allowedOrigins: [props.appOrigin], allowedHeaders: ["content-type"], maxAge: 3000 }],
      lifecycleRules: [
        { transitions: [{ storageClass: s3.StorageClass.INFREQUENT_ACCESS, transitionAfter: Duration.days(90) }] },
        { prefix: "tmp/", expiration: Duration.days(2) },
        // Email-in objects are moved under u/ once processed; anything left a week is junk.
        { prefix: "inbound/", expiration: Duration.days(7) },
      ],
    });

    const user = new iam.User(this, "AppUser", { userName: "pluck-app" });
    this.bucket.grantReadWrite(user);
    this.bucket.grantDelete(user);
    props.emailIdentity.grantSendEmail(user);

    // The secret key goes to Secrets Manager, never to a stack output. Copy it into Vercel env by hand.
    const key = new iam.AccessKey(this, "AppUserKey", { user });
    new secrets.Secret(this, "AppUserSecret", {
      secretName: "pluck/app-user",
      secretObjectValue: { AWS_ACCESS_KEY_ID: SecretValue.unsafePlainText(key.accessKeyId), AWS_SECRET_ACCESS_KEY: key.secretAccessKey },
    });

    new CfnOutput(this, "BucketName", { value: this.bucket.bucketName });
    new CfnOutput(this, "AppUserSecretName", { value: "pluck/app-user" });
  }
}
