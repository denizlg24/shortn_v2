import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import env from "@/utils/env";

export { assetUrl, keyFromAssetUrl } from "./storage-keys";

let client: S3Client | undefined;

function getClient(): S3Client {
  return (client ??= new S3Client({
    endpoint: env.S3_ENDPOINT,
    region: env.S3_REGION,
    forcePathStyle: true,
    credentials: {
      accessKeyId: env.S3_ACCESS_KEY_ID,
      secretAccessKey: env.S3_SECRET_ACCESS_KEY,
    },
    // Basic S3 gateways may not support the SDK's optional checksum trailers.
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  }));
}

export async function putObject(
  key: string,
  body: Uint8Array,
  contentType: string,
) {
  await getClient().send(
    new PutObjectCommand({
      Bucket: env.S3_BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
    }),
  );
}

export async function getObjectStream(key: string) {
  const object = await getClient().send(
    new GetObjectCommand({
      Bucket: env.S3_BUCKET,
      Key: key,
    }),
  );
  if (!object.Body) throw new Error("Missing S3 object body");
  return {
    stream: object.Body.transformToWebStream(),
    contentType: object.ContentType ?? "application/octet-stream",
  };
}

export async function deleteObject(key: string) {
  await getClient().send(
    new DeleteObjectCommand({
      Bucket: env.S3_BUCKET,
      Key: key,
    }),
  );
}
