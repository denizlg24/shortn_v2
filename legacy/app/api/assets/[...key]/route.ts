import { getObjectStream } from "@/lib/storage";
import { isValidUploadKey } from "@/lib/storage-keys";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ key: string[] }> },
) {
  const { key: segments } = await context.params;
  // Next.js has already decoded these segments. Reject embedded separators too.
  if (
    segments.some((segment) => segment.includes("/")) ||
    !isValidUploadKey(segments.join("/"))
  ) {
    return new Response(null, { status: 404 });
  }
  try {
    const object = await getObjectStream(segments.join("/"));
    return new Response(object.stream, {
      headers: {
        "Content-Type": object.contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
        "Content-Disposition": "inline",
      },
    });
  } catch (error) {
    if (
      error instanceof Error &&
      (error.name === "NoSuchKey" ||
        error.name === "NotFound" ||
        ("$metadata" in error &&
          (error.$metadata as { httpStatusCode?: number }).httpStatusCode ===
            404))
    ) {
      return new Response(null, { status: 404 });
    }
    // Keep storage details and credentials out of public responses.
    return new Response(null, { status: 500 });
  }
}
