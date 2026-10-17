import {
  cancelWorkspaceExport,
  getWorkspaceExport,
  workspaceExportDelivery,
} from "@shortn/core";
import { env } from "@/server/env";
import { linkExportHttpContext, linkExportStore } from "@/server/link-exports";
import {
  exportJson,
  exportHttpError,
  sameExportOrigin,
  readExportJson,
} from "@/server/link-export-http";

export const runtime = "nodejs";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ workspace: string; id: string }> },
) {
  try {
    const { workspace, id } = await params,
      access = await linkExportHttpContext(workspace);
    if (!access.ctx) return exportJson({ error: access.error }, access.status);
    const store = linkExportStore();
    if (!store) return exportJson({ error: "unavailable" }, 503);
    const job = await workspaceExportDelivery(access.ctx, id, store.sign);
    return job ? exportJson(job) : exportJson({ error: "not_found" }, 404);
  } catch (error) {
    return exportHttpError(error);
  }
}
export async function POST(
  request: Request,
  { params }: { params: Promise<{ workspace: string; id: string }> },
) {
  if (!sameExportOrigin(request, env().BETTER_AUTH_URL))
    return exportJson({ error: "invalid_origin" }, 403);
  try {
    const { workspace, id } = await params,
      access = await linkExportHttpContext(workspace);
    if (!access.ctx) return exportJson({ error: access.error }, access.status);
    if (!linkExportStore()) return exportJson({ error: "unavailable" }, 503);
    const body = await readExportJson(request);
    if (!body.ok) return exportJson({ error: body.error }, body.status);
    if (
      !body.value ||
      typeof body.value !== "object" ||
      Object.keys(body.value).length !== 1 ||
      !("action" in body.value) ||
      body.value.action !== "cancel"
    )
      return exportJson({ error: "invalid_export" }, 400);
    const job = await getWorkspaceExport(access.ctx, id);
    if (!job) return exportJson({ error: "not_found" }, 404);
    if (job.state === "cancelled") return exportJson({ cancelled: true });
    return (await cancelWorkspaceExport(access.ctx, id))
      ? exportJson({ cancelled: true })
      : exportJson({ error: "invalid_state" }, 409);
  } catch (error) {
    return exportHttpError(error);
  }
}
