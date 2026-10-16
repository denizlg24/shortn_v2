import {
  S3Client,
  HeadObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Upload } from "@aws-sdk/lib-storage";
import { Readable } from "node:stream";

export interface ObjectStore {
  head(key: string): Promise<{ bytes: number; contentType: string } | null>;
  get(key: string, maximumBytes: number): Promise<Uint8Array>;
  put(key: string, bytes: Uint8Array, contentType: string): Promise<void>;
  sign(key: string, seconds: number, filename: string): Promise<string>;
  signImportUpload?(
    key: string,
    bytes: number,
    seconds?: number,
  ): Promise<string>;
  putStream?(
    key: string,
    chunks: AsyncIterable<Uint8Array>,
    contentType: string,
    maximumBytes: number,
  ): Promise<number>;
}
export interface StorageConfig {
  S3_ENDPOINT: string;
  S3_REGION: string;
  S3_BUCKET: string;
  S3_ACCESS_KEY_ID: string;
  S3_SECRET_ACCESS_KEY: string;
}
export function createObjectStore(config: StorageConfig): ObjectStore {
  const client = new S3Client({
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
  const key = (value: string) => {
    if (
      !/^(?:exports|uploads|imports)\/[a-zA-Z0-9_./@|+-]+$/.test(value) ||
      value
        .split("/")
        .some((part) => !part || part === "." || part.includes(".."))
    )
      throw new Error("invalid_object_key");
    return { Bucket: config.S3_BUCKET, Key: value };
  };
  return {
    async signImportUpload(value, bytes, seconds = 900) {
      if (
        !/^imports\/[a-f\d]{24}\/[a-f\d]{24}\.csv$/i.test(value) ||
        !Number.isInteger(bytes) ||
        bytes < 1 ||
        bytes > 10 * 1024 * 1024 ||
        !Number.isInteger(seconds) ||
        seconds < 1 ||
        seconds > 900
      )
        throw new Error("invalid_import_upload");
      return getSignedUrl(
        client,
        new PutObjectCommand({
          ...key(value),
          ContentType: "text/csv; charset=utf-8",
          ContentLength: bytes,
          IfNoneMatch: "*",
          CacheControl: "private, no-store",
        }),
        {
          expiresIn: seconds,
          signableHeaders: new Set([
            "content-type",
            "content-length",
            "if-none-match",
            "cache-control",
          ]),
        },
      );
    },
    async putStream(value, chunks, contentType, maximumBytes) {
      if (
        !Number.isSafeInteger(maximumBytes) ||
        maximumBytes < 1 ||
        maximumBytes > 1024 * 1024 * 1024
      )
        throw new Error("invalid_size");
      let length = 0;
      const bounded = async function* () {
        for await (const chunk of chunks) {
          length += chunk.length;
          if (length > maximumBytes) throw new Error("archive_too_large");
          yield chunk;
        }
      };
      const body = Readable.from(bounded(), { objectMode: false });
      const upload = new Upload({
        client,
        params: {
          ...key(value),
          Body: body,
          ContentType: contentType,
          CacheControl: "private, max-age=86400",
        },
        queueSize: 1,
        partSize: 5 * 1024 * 1024,
        leavePartsOnError: false,
      });
      const timeout = setTimeout(() => {
        void upload.abort().catch(() => {});
        body.destroy(new Error("upload_timeout"));
      }, 15 * 60_000);
      try {
        await upload.done();
        return length;
      } finally {
        clearTimeout(timeout);
        body.destroy();
      }
    },
    async head(value) {
      try {
        const object = await client.send(new HeadObjectCommand(key(value)), {
          abortSignal: AbortSignal.timeout(30_000),
        });
        return {
          bytes: object.ContentLength ?? 0,
          contentType: object.ContentType ?? "application/octet-stream",
        };
      } catch (error) {
        if (
          (error as { $metadata?: { httpStatusCode?: number } }).$metadata
            ?.httpStatusCode === 404
        )
          return null;
        throw error;
      }
    },
    async get(value, maximumBytes) {
      if (
        !Number.isInteger(maximumBytes) ||
        maximumBytes < 1 ||
        maximumBytes > 64 * 1024 * 1024
      )
        throw new Error("invalid_size");
      const object = await client.send(new GetObjectCommand(key(value)), {
        abortSignal: AbortSignal.timeout(30_000),
      });
      if (!object.Body) throw new Error("object_missing");
      const reader = object.Body.transformToWebStream().getReader();
      const pieces: Uint8Array[] = [];
      let length = 0;
      try {
        if ((object.ContentLength ?? 0) > maximumBytes)
          throw new Error("object_too_large");
        while (true) {
          const next = await reader.read();
          if (next.done) break;
          const chunk = next.value;
          length += chunk.length;
          if (length > maximumBytes) throw new Error("object_too_large");
          pieces.push(chunk);
        }
        return new Uint8Array(Buffer.concat(pieces, length));
      } finally {
        await reader.cancel().catch(() => {});
      }
    },
    async put(value, bytes, contentType) {
      await client.send(
        new PutObjectCommand({
          ...key(value),
          Body: bytes,
          ContentType: contentType,
          CacheControl: "private, max-age=86400",
        }),
        { abortSignal: AbortSignal.timeout(30_000) },
      );
    },
    async sign(value, seconds, filename) {
      if (
        !Number.isInteger(seconds) ||
        seconds < 1 ||
        seconds > 86400 ||
        !/^[a-zA-Z0-9_.-]{1,160}$/.test(filename)
      )
        throw new Error("invalid_delivery");
      return getSignedUrl(
        client,
        new GetObjectCommand({
          ...key(value),
          ResponseContentDisposition: `attachment; filename="${filename}"`,
          ResponseCacheControl: "private, no-store",
        }),
        { expiresIn: seconds },
      );
    },
  };
}

/** Accept stored upload URLs only; URL normalization must not hide traversal. */
export function storedUploadKey(
  value: string,
  allowedOrigins: string[],
): string | null {
  try {
    const url = new URL(value);
    const rawPath = value.match(/^https?:\/\/[^/?#]+([^?#]*)/)?.[1];
    if (
      !allowedOrigins.includes(url.origin) ||
      url.username ||
      url.password ||
      url.hash ||
      url.search ||
      rawPath !== url.pathname ||
      !url.pathname.startsWith("/api/assets/")
    )
      return null;
    const parts = url.pathname
      .slice("/api/assets/".length)
      .split("/")
      .map(decodeURIComponent);
    if (
      parts.length < 3 ||
      parts.length > 5 ||
      parts[0] !== "uploads" ||
      parts.some(
        (part) =>
          !/^[a-zA-Z0-9_.@|+-]+$/.test(part) ||
          part === "." ||
          part.includes(".."),
      )
    )
      return null;
    return parts.join("/");
  } catch {
    return null;
  }
}
