import { z } from "zod";
import { prepareWorkspaceExport, listWorkspaceExports } from "@shortn/core";
import { env } from "@/server/env";
import { linkExportHttpContext, linkExportStore } from "@/server/link-exports";
import {
  exportJson,
  exportHttpError,
  readExportJson,
  sameExportOrigin,
} from "@/server/link-export-http";

export const runtime = "nodejs";
const input = z.object({ requestId: z.uuid().optional() }).strict();
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
    const parsed = input.safeParse(body.value);
    if (!parsed.success) return exportJson({ error: "invalid_export" }, 400);
    const result = await prepareWorkspaceExport(
      access.ctx,
      parsed.data.requestId,
    );
    if (!result.ok)
      return exportJson(
        { error: result.error },
        result.error === "expired"
          ? 404
          : result.error === "export_in_progress"
            ? 409
            : 400,
      );
    return exportJson(
      {
        job: result.value,
        statusUrl: `/api/workspace-exports/${encodeURIComponent(workspace)}/jobs/${result.value.id}`,
      },
      202,
    );
  } catch (error) {
    return exportHttpError(error);
  }
}
export async function GET(
  request: Request,
  { params }: { params: Promise<{ workspace: string }> },
) {
  try {
    const { workspace } = await params,
      access = await linkExportHttpContext(workspace);
    if (!access.ctx) return exportJson({ error: access.error }, access.status);
    if (!linkExportStore()) return exportJson({ error: "unavailable" }, 503);
    const query = new URL(request.url).searchParams;
    const value = await listWorkspaceExports(access.ctx, {
      page: Number(query.get("page") ?? "1"),
      state: query.get("state") ?? "",
    });
    return value ? exportJson(value) : exportJson({ error: "not_found" }, 404);
  } catch (error) {
    return exportHttpError(error);
  }
}
