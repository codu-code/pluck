// Direct database access for e2e setup that the app has no route for (ageing items). Same dev database as the server.
process.env.MONGODB_URI ??= "mongodb://127.0.0.1:27027/pluck?replicaSet=rs0&directConnection=true";
export { ageItemsOf, ageListsOf } from "@pluck/db/testing";

// e2e: drop a raw email where SES would put it.
process.env.S3_BUCKET ??= "pluck-content";
process.env.S3_ENDPOINT ??= "http://127.0.0.1:9010";
process.env.AWS_ACCESS_KEY_ID ??= "pluck";
process.env.AWS_SECRET_ACCESS_KEY ??= "pluck-dev-secret";
process.env.AWS_REGION ??= "eu-west-1";
export { putObject } from "@pluck/blob";
