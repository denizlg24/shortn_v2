import { LinkExportError } from "@shortn/core";

export const privateExportHeaders = {
  "Cache-Control": "private, no-store",
  Vary: "Cookie",
  "X-Content-Type-Options": "nosniff",
} as const;
export function exportJson(value: unknown, status = 200) {
  return Response.json(value, { status, headers: privateExportHeaders });
}
export function exportHttpError(error: unknown) {
  const code = error instanceof LinkExportError ? error.code : "failed";
  return exportJson(
    { error: code },
    code === "forbidden" || code === "feature_required"
      ? 403
      : code === "invalid_export"
        ? 400
        : code === "export_cancelled"
          ? 409
          : 503,
  );
}
export function sameExportOrigin(request: Request, origin: string) {
  try {
    return request.headers.get("origin") === new URL(origin).origin;
  } catch {
    return false;
  }
}
/** Bound the body even without Content-Length; CSV bytes never enter this route. */
export async function readExportJson(request: Request) {
  if (
    !/^application\/json(?:\s*;|$)/i.test(
      request.headers.get("content-type") ?? "",
    )
  )
    return { ok: false, status: 415, error: "invalid_content_type" } as const;
  const reader = request.body?.getReader();
  if (!reader)
    return { ok: false, status: 400, error: "invalid_export" } as const;
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      length += chunk.value.byteLength;
      if (length > 32768) {
        await reader.cancel();
        return { ok: false, status: 413, error: "request_too_large" } as const;
      }
      chunks.push(chunk.value);
    }
    const bytes = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.length;
    }
    return {
      ok: true,
      value: JSON.parse(
        new TextDecoder("utf-8", { fatal: true }).decode(bytes),
      ) as unknown,
    } as const;
  } catch {
    return { ok: false, status: 400, error: "invalid_export" } as const;
  } finally {
    reader.releaseLock();
  }
}
/** Pull-based adapter keeps backpressure and returns the iterator on disconnect. */
export async function linkExportFileResponse(
  iterator: AsyncGenerator<Uint8Array>,
  format: "csv" | "json",
  signal: AbortSignal,
  abort: () => void,
) {
  const first = await iterator.next();
  let closed = false,
    controller: ReadableStreamDefaultController<Uint8Array> | undefined,
    cleanup: Promise<void> | undefined;
  const close = () => {
    if (!cleanup) {
      closed = true;
      signal.removeEventListener("abort", onAbort);
      abort();
      cleanup = iterator.return(undefined).then(() => undefined);
    }
    return cleanup;
  };
  const onAbort = () => {
    if (!closed) {
      controller?.error(new Error("export_cancelled"));
      void close().catch(() => undefined);
    }
  };
  const stream = new ReadableStream<Uint8Array>({
    start(value) {
      controller = value;
      if (first.done) {
        value.close();
        void close();
      } else value.enqueue(first.value);
    },
    async pull(value) {
      if (closed) return;
      try {
        const next = await iterator.next();
        if (closed) return;
        if (next.done) {
          value.close();
          await close();
        } else value.enqueue(next.value);
      } catch (error) {
        if (!closed) value.error(error);
        await close();
      }
    },
    async cancel() {
      await close();
    },
  });
  if (!closed) {
    signal.addEventListener("abort", onAbort, { once: true });
    if (signal.aborted) onAbort();
  }
  return new Response(stream, {
    headers: {
      ...privateExportHeaders,
      "Content-Type":
        format === "csv"
          ? "text/csv; charset=utf-8"
          : "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="shortn-links.${format}"`,
    },
  });
}
