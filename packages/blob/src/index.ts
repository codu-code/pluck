import { CopyObjectCommand, DeleteObjectCommand, DeleteObjectsCommand, GetObjectCommand, ListObjectsV2Command, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// One S3 code path everywhere: AWS S3 in prod, MinIO locally and for self-host (S3_ENDPOINT set).
let client: S3Client | undefined;
const s3 = () =>
  (client ??= new S3Client({
    region: process.env.AWS_REGION ?? "eu-west-1",
    ...(process.env.S3_ENDPOINT ? { endpoint: process.env.S3_ENDPOINT, forcePathStyle: true } : {}),
  }));
const bucket = () => {
  const b = process.env.S3_BUCKET;
  if (!b) throw new Error("S3_BUCKET is not set");
  return b;
};

export const keys = {
  html: (userId: string, itemId: string) => `u/${userId}/items/${itemId}/raw.html`,
  cover: (userId: string, itemId: string) => `u/${userId}/items/${itemId}/cover`,
  file: (userId: string, itemId: string, ext: string) => `u/${userId}/items/${itemId}/file.${ext}`,
  user: (userId: string) => `u/${userId}/`,
};

export async function putObject(key: string, body: Buffer | string, contentType: string): Promise<void> {
  await s3().send(new PutObjectCommand({ Bucket: bucket(), Key: key, Body: body, ContentType: contentType }));
}

export async function getObject(key: string): Promise<Buffer> {
  const res = await s3().send(new GetObjectCommand({ Bucket: bucket(), Key: key }));
  return Buffer.from(await res.Body!.transformToByteArray());
}

// A short-lived URL a browser can PUT a file to directly (imports can be bigger than a request body allows).
export function signedPutUrl(key: string, contentType: string, expiresIn = 900): Promise<string> {
  return getSignedUrl(s3(), new PutObjectCommand({ Bucket: bucket(), Key: key, ContentType: contentType }), { expiresIn });
}

export function signedUrl(key: string, expiresIn = 300): Promise<string> {
  return getSignedUrl(s3(), new GetObjectCommand({ Bucket: bucket(), Key: key }), { expiresIn });
}

// Removes everything under a prefix. Used by account deletion.
export async function deletePrefix(prefix: string): Promise<number> {
  let deleted = 0;
  let token: string | undefined;
  do {
    const page = await s3().send(new ListObjectsV2Command({ Bucket: bucket(), Prefix: prefix, ContinuationToken: token }));
    const objects = (page.Contents ?? []).map((o) => ({ Key: o.Key! }));
    if (objects.length) await s3().send(new DeleteObjectsCommand({ Bucket: bucket(), Delete: { Objects: objects } }));
    deleted += objects.length;
    token = page.NextContinuationToken;
  } while (token);
  return deleted;
}

export async function listKeys(prefix: string, max = 50): Promise<{ key: string; size: number }[]> {
  const page = await s3().send(new ListObjectsV2Command({ Bucket: bucket(), Prefix: prefix, MaxKeys: max }));
  return (page.Contents ?? []).map((o) => ({ key: o.Key!, size: o.Size ?? 0 }));
}

export async function moveObject(from: string, to: string): Promise<void> {
  await s3().send(new CopyObjectCommand({ Bucket: bucket(), CopySource: `${bucket()}/${encodeURIComponent(from)}`, Key: to }));
  await deleteObject(from);
}

export async function deleteObject(key: string): Promise<void> {
  await s3().send(new DeleteObjectCommand({ Bucket: bucket(), Key: key }));
}
