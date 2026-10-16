import { expect, test } from "bun:test";
import { createObjectStore } from "./index";

test("streams multipart data in bounded parts and aborts incomplete oversized uploads", async () => {
  const uploads = new Map<string, Map<number, Uint8Array>>();
  let completed = new Uint8Array(),
    aborts = 0,
    largestPart = 0;
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    async fetch(request) {
      const url = new URL(request.url),
        id = url.searchParams.get("uploadId");
      const xml = (text: string) =>
        new Response(text, { headers: { "Content-Type": "application/xml" } });
      if (request.method === "POST" && url.searchParams.has("uploads")) {
        const uploadId = crypto.randomUUID();
        uploads.set(uploadId, new Map());
        return xml(
          `<InitiateMultipartUploadResult><Bucket>synthetic</Bucket><Key>exports/jobs/test.zip</Key><UploadId>${uploadId}</UploadId></InitiateMultipartUploadResult>`,
        );
      }
      if (request.method === "PUT" && id) {
        const bytes = new Uint8Array(await request.arrayBuffer());
        largestPart = Math.max(largestPart, bytes.length);
        uploads.get(id)!.set(Number(url.searchParams.get("partNumber")), bytes);
        return new Response(null, { headers: { ETag: '"synthetic-part"' } });
      }
      if (request.method === "POST" && id) {
        const parts = [...uploads.get(id)!.entries()]
          .sort(([a], [b]) => a - b)
          .map(([, value]) => value);
        completed = new Uint8Array(Buffer.concat(parts));
        uploads.delete(id);
        return xml(
          '<CompleteMultipartUploadResult><Location>http://localhost/synthetic</Location><Bucket>synthetic</Bucket><Key>exports/jobs/test.zip</Key><ETag>"synthetic-completed"</ETag></CompleteMultipartUploadResult>',
        );
      }
      if (request.method === "DELETE" && id) {
        aborts++;
        uploads.delete(id);
        return new Response(null, { status: 204 });
      }
      return new Response(null, { status: 404 });
    },
  });
  const store = createObjectStore({
    S3_ENDPOINT: `http://127.0.0.1:${server.port}`,
    S3_REGION: "local",
    S3_BUCKET: "synthetic",
    S3_ACCESS_KEY_ID: "synthetic",
    S3_SECRET_ACCESS_KEY: "synthetic-secret",
  });
  const chunks = async function* () {
    for (let index = 0; index < 6; index++)
      yield new Uint8Array(1024 * 1024).fill(index);
  };
  try {
    expect(
      await store.putStream!(
        "exports/jobs/test.zip",
        chunks(),
        "application/zip",
        8 * 1024 * 1024,
      ),
    ).toBe(6 * 1024 * 1024);
    expect(completed.length).toBe(6 * 1024 * 1024);
    expect(completed[5 * 1024 * 1024]).toBe(5);
    expect(largestPart).toBe(5 * 1024 * 1024);
    const tooLarge = async function* () {
      for (let index = 0; index < 8; index++) yield new Uint8Array(1024 * 1024);
    };
    await expect(
      store.putStream!(
        "exports/jobs/oversized.zip",
        tooLarge(),
        "application/zip",
        7 * 1024 * 1024 + 1,
      ),
    ).rejects.toThrow("archive_too_large");
    expect(aborts).toBe(1);
    expect(uploads.size).toBe(0);
  } finally {
    server.stop(true);
  }
});
