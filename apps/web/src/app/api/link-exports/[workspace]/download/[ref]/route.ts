import { authorizeLinkExport, streamFilteredLinkExport } from "@shortn/core";
import {
  linkExportHttpContext,
  linkExportStore,
  readLinkExportSelection,
} from "@/server/link-exports";
import {
  exportJson,
  exportHttpError,
  linkExportFileResponse,
  privateExportHeaders,
} from "@/server/link-export-http";

export const runtime = "nodejs";
export async function HEAD(
  _request: Request,
  { params }: { params: Promise<{ workspace: string; ref: string }> },
) {
  try {
    const { workspace, ref } = await params,
      access = await linkExportHttpContext(workspace);
    if (!access.ctx) return exportJson({ error: access.error }, access.status);
    if (!linkExportStore()) return exportJson({ error: "unavailable" }, 503);
    const selection = await readLinkExportSelection(access.ctx, ref);
    if (!selection) return exportJson({ error: "not_found" }, 404);
    await authorizeLinkExport(access.ctx, Boolean(selection.filter.campaign));
    return new Response(null, {
      headers: {
        ...privateExportHeaders,
        "Content-Type":
          selection.format === "csv"
            ? "text/csv; charset=utf-8"
            : "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="shortn-links.${selection.format}"`,
      },
    });
  } catch (error) {
    return exportHttpError(error);
  }
}
export async function GET(
  request: Request,
  { params }: { params: Promise<{ workspace: string; ref: string }> },
) {
  try {
    const { workspace, ref } = await params,
      access = await linkExportHttpContext(workspace);
    if (!access.ctx) return exportJson({ error: access.error }, access.status);
    if (!linkExportStore()) return exportJson({ error: "unavailable" }, 503);
    const selection = await readLinkExportSelection(access.ctx, ref);
    if (!selection) return exportJson({ error: "not_found" }, 404);
    const controller = new AbortController(),
      signal = AbortSignal.any([request.signal, controller.signal]);
    return await linkExportFileResponse(
      streamFilteredLinkExport(
        access.ctx,
        selection.filter,
        selection.format,
        signal,
        selection.selection,
      ),
      selection.format,
      request.signal,
      () => controller.abort(),
    );
  } catch (error) {
    return exportHttpError(error);
  }
}
