import {
  afterEach,
  beforeEach,
  expect,
  mock,
  spyOn,
  test,
  type Mock,
} from "bun:test";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { assetUrl } from "../lib/storage-keys";
import { MAX_IMAGE_BYTES } from "../lib/image-type";

let session: { user: { sub: string } } | null = { user: { sub: "google|123" } };
const getSession = mock(async () => session);
// Avoid importing auth.ts: it connects to Mongo as a side effect.
mock.module("../lib/session", () => ({ getServerSession: getSession }));
const { uploadImage } = await import("../app/actions/uploadImage");
const { deletePicture } = await import("../app/actions/deletePicture");
const { GET } = await import("../app/api/assets/[...key]/route");
const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
// S3Client.send also has callback overloads; these helpers use its Promise form.
let send: Mock<(command: unknown) => Promise<unknown>>;

beforeEach(() => {
  session = { user: { sub: "google|123" } };
  getSession.mockClear();
  send = spyOn(S3Client.prototype, "send") as unknown as typeof send;
  send.mockResolvedValue({});
});
afterEach(() => send.mockRestore());

test("upload uses bytes rather than MIME or filename and returns the existing result shape", async () => {
  const result = await uploadImage(
    new File([png], "fake.svg", { type: "image/svg+xml" }),
  );
  expect(result.success).toBe(true);
  expect(typeof result.url).toBe("string");
  expect(send).toHaveBeenCalledTimes(1);
  const command = send.mock.calls[0][0] as PutObjectCommand;
  expect(command).toBeInstanceOf(PutObjectCommand);
  expect(command.input.Bucket).toBe("shortn-v2-staging");
  expect(command.input.ContentType).toBe("image/png");
  expect(command.input.Body).toEqual(png);
  expect(command.input.Key).toMatch(
    /^uploads\/google\|123\/[0-9a-f-]{36}\.png$/,
  );
  expect(result.url).toBe(assetUrl(command.input.Key!));
  const client = send.mock.contexts[0] as S3Client;
  expect(client.config.forcePathStyle).toBe(true);
  expect(await client.config.region()).toBe("eu-west-1");
  expect(await client.config.endpoint!()).toMatchObject({
    hostname: "s3.test",
    path: "/v2",
  });
});

test("unauthenticated upload fails before storage", async () => {
  session = null;
  expect(await uploadImage(new File([png], "photo.png"))).toEqual({
    success: false,
    url: false,
  });
  expect(send).not.toHaveBeenCalled();
});

test("a file just above 5 MB fails before reading bytes", async () => {
  const file = new File([new Uint8Array(MAX_IMAGE_BYTES + 1)], "photo.png", {
    type: "image/png",
  });
  const read = spyOn(file, "arrayBuffer");
  expect(await uploadImage(file)).toEqual({ success: false, url: false });
  expect(read).not.toHaveBeenCalled();
  expect(send).not.toHaveBeenCalled();
  read.mockRestore();
});

test("a file at the 5 MB boundary is accepted", async () => {
  const bytes = new Uint8Array(MAX_IMAGE_BYTES);
  bytes.set(png);
  expect((await uploadImage(new File([bytes], "photo.png"))).success).toBe(
    true,
  );
  expect(send).toHaveBeenCalledTimes(1);
});

test("SVG with a spoofed image/png MIME fails", async () => {
  expect(
    await uploadImage(
      new File(["<svg onload='alert(1)'/>"], "photo.png", {
        type: "image/png",
      }),
    ),
  ).toEqual({ success: false, url: false });
  expect(send).not.toHaveBeenCalled();
});

test("owned deletion uses only the owner's S3 key", async () => {
  expect(await deletePicture(assetUrl("uploads/google|123/photo.png"))).toEqual(
    { success: true, message: null },
  );
  const command = send.mock.calls[0][0] as DeleteObjectCommand;
  expect(command).toBeInstanceOf(DeleteObjectCommand);
  expect(command.input).toEqual({
    Bucket: "shortn-v2-staging",
    Key: "uploads/google|123/photo.png",
  });
});

test("another user's key and prefix lookalikes cannot be deleted", async () => {
  for (const sub of ["google|12", "google|1234", "other"]) {
    expect(
      (await deletePicture(assetUrl(`uploads/${sub}/photo.png`))).success,
    ).toBe(false);
  }
  expect(send).not.toHaveBeenCalled();
});

test("legacy Pinata and foreign URLs are successful no-ops", async () => {
  for (const url of [
    "https://sapphire-high-sailfish-380.mypinata.cloud/ipfs/old-cid",
    "https://evil.test/api/assets/uploads/google%7C123/photo.png",
  ])
    expect(await deletePicture(url)).toEqual({ success: true, message: null });
  expect(send).not.toHaveBeenCalled();
});

test("deletion requires a session", async () => {
  session = null;
  expect(await deletePicture(assetUrl("uploads/google|123/photo.png"))).toEqual(
    { success: false, message: "no-user" },
  );
  expect(send).not.toHaveBeenCalled();
});

async function getAsset(key: string[]) {
  return GET(new Request("https://shortn.test/api/assets/ignored"), {
    params: Promise.resolve({ key }),
  });
}

test.each(
  [
    [],
    ["uploads"],
    ["private", "user", "photo.png"],
    ["uploads", "", "photo.png"],
    ["uploads", "user", "..", "photo.png"],
    ["uploads", "user", ".", "photo.png"],
    ["uploads", "user", ""],
    ["uploads", "user/other", "photo.png"],
    ["uploads", "user", "%2e%2e"],
    ["uploads", "user", "..\\photo.png"],
  ].map((segments) => ({ segments })),
)("assets route rejects unsafe segments: %j", async ({ segments }) => {
  expect((await getAsset(segments)).status).toBe(404);
  expect(send).not.toHaveBeenCalled();
});

test("assets are streamed publicly with immutable caching and safe headers", async () => {
  session = null;
  const stream = new ReadableStream<Uint8Array<ArrayBuffer>>({
    start(controller) {
      controller.enqueue(png);
      controller.close();
    },
  });
  const toStream = mock(() => stream);
  send.mockResolvedValue({
    Body: { transformToWebStream: toStream },
    ContentType: "image/png",
  });
  const result = await getAsset(["uploads", "google|123", "photo.png"]);
  expect(result.status).toBe(200);
  expect(result.body).toBe(stream);
  expect(result.headers.get("Content-Type")).toBe("image/png");
  expect(result.headers.get("Cache-Control")).toBe(
    "public, max-age=31536000, immutable",
  );
  expect(result.headers.get("X-Content-Type-Options")).toBe("nosniff");
  expect(result.headers.get("Content-Disposition")).toBe("inline");
  expect(new Uint8Array(await result.arrayBuffer())).toEqual(png);
  expect(toStream).toHaveBeenCalledTimes(1);
  expect(getSession).not.toHaveBeenCalled();
  const command = send.mock.calls[0][0] as GetObjectCommand;
  expect(command).toBeInstanceOf(GetObjectCommand);
  expect(command.input).toEqual({
    Bucket: "shortn-v2-staging",
    Key: "uploads/google|123/photo.png",
  });
});

test.each(["NoSuchKey", "NotFound", "S3ServiceException"])(
  "missing S3 object returns 404: %s",
  async (name) => {
    send.mockRejectedValue(
      Object.assign(new Error("missing"), {
        name,
        $metadata: { httpStatusCode: 404 },
      }),
    );
    expect((await getAsset(["uploads", "user", "missing.png"])).status).toBe(
      404,
    );
  },
);

test("unexpected S3 failures return a generic 500", async () => {
  send.mockRejectedValue(new Error("sensitive storage detail"));
  const result = await getAsset(["uploads", "user", "photo.png"]);
  expect(result.status).toBe(500);
  expect(await result.text()).toBe("");
});
