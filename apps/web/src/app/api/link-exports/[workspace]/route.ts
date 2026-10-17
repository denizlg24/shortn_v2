import { env } from "@/server/env";
import {
  linkExportHttpContext,
  linkExportStore,
  requestLinksExport,
} from "@/server/link-exports";
import {
  exportJson,
  exportHttpError,
  readExportJson,
  sameExportOrigin,
} from "@/server/link-export-http";

export const runtime = "nodejs";
export async function POST(
  request: Request,
  { params }: { params: Promise<{ workspace: string }> },
) {
  if (!sameExportOrigin(request, env().BETTER_AUTH_URL))
    return exportJson({ error: "invalid_origin" }, 403);
  try {
    const { workspace } = await params,
      access = await linkExportHttpContext(workspace);
    if (!access.ctx) return exportJson({ error: access.error }, access.status);
    if (!linkExportStore()) return exportJson({ error: "unavailable" }, 503);
    const body = await readExportJson(request);
    if (!body.ok) return exportJson({ error: body.error }, body.status);
    const result = await requestLinksExport(access.ctx, workspace, body.value);
    if (!result.ok)
      return exportJson(
        { error: result.error },
        result.error === "idempotency_conflict"
          ? 409
          : result.error === "expired"
            ? 404
            : 400,
      );
    return exportJson(result.value, result.value.mode === "job" ? 202 : 201);
  } catch (error) {
    return exportHttpError(error);
  }
}
