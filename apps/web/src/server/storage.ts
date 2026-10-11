import "server-only";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { env } from "./env";

let client: S3Client | undefined;
export function storage() {
  const config = env();
  if (
    !config.S3_ENDPOINT ||
    !config.S3_REGION ||
    !config.S3_BUCKET ||
    !config.S3_ACCESS_KEY_ID ||
    !config.S3_SECRET_ACCESS_KEY
  )
    return null;
  client ??= new S3Client({
    endpoint: config.S3_ENDPOINT,
    region: config.S3_REGION,
    forcePathStyle: true,
    credentials: {
      accessKeyId: config.S3_ACCESS_KEY_ID,
      secretAccessKey: config.S3_SECRET_ACCESS_KEY,
    },
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  });
  return {
    put: (key: string, body: Uint8Array) =>
      client!.send(
        new PutObjectCommand({
          Bucket: config.S3_BUCKET!,
          Key: key,
          Body: body,
          ContentType: "image/png",
          CacheControl: "public, max-age=31536000, immutable",
        }),
      ),
    get: (key: string) =>
      client!.send(
        new GetObjectCommand({ Bucket: config.S3_BUCKET!, Key: key }),
      ),
  };
}

export function validAssetKey(segments: string[]) {
  return (
    segments.length >= 3 &&
    segments.length <= 5 &&
    segments[0] === "uploads" &&
    segments.every(
      (part) =>
        /^[a-zA-Z0-9_.@|+-]+$/.test(part) &&
        part !== "." &&
        !part.includes(".."),
    )
  );
}
export function assetUrl(key: string) {
  return new URL(
    `/api/assets/${key.split("/").map(encodeURIComponent).join("/")}`,
    env().BETTER_AUTH_URL,
  ).href;
}
