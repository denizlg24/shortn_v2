import { storage, validAssetKey } from "@/server/storage";

export const runtime = "nodejs";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ key: string[] }> },
) {
  const { key } = await params;
  if (!validAssetKey(key)) return new Response(null, { status: 404 });
  const store = storage();
  if (!store) return new Response(null, { status: 503 });
  try {
    const object = await store.get(key.join("/"));
    if (!object.Body) return new Response(null, { status: 404 });
    return new Response(object.Body.transformToWebStream(), {
      headers: {
        "content-type": object.ContentType ?? "image/png",
        "cache-control": "public, max-age=31536000, immutable",
        "access-control-allow-origin": "*",
        "x-content-type-options": "nosniff",
        "content-disposition": "inline",
        "content-security-policy":
          "default-src 'none'; style-src 'unsafe-inline'; sandbox",
      },
    });
  } catch (error) {
    const missing =
      error instanceof Error &&
      (error.name === "NoSuchKey" || error.name === "NotFound");
    return new Response(null, { status: missing ? 404 : 502 });
  }
}
