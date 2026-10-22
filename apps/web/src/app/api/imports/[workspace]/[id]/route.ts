import { uploadImportSource, workspaceContext } from "@shortn/core";
import { getSession } from "@/server/auth";
import { db } from "@/server/db";
import { env } from "@/server/env";
import { importStore } from "@/server/imports";
import { serviceContext } from "@/server/context";
import { auditImpersonatedRequest } from "@/server/workspace";

export const runtime = "nodejs";
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ workspace: string; id: string }> },
) {
  const failure = (error: string, status: number) =>
    Response.json({ error }, { status });
  if (env().IMPORT_UPLOAD_PROXY_ENABLED !== "1")
    return failure("not_found", 404);
  if (request.headers.get("origin") !== new URL(env().BETTER_AUTH_URL).origin)
    return failure("forbidden", 403);
  const session = await getSession();
  if (!session) return failure("unauthenticated", 401);
  const { workspace, id } = await params;
  const ctx = await workspaceContext(await db(), session.user.id, workspace);
  if (!ctx) return failure("not_found", 404);
  // Lock and read-only impersonation are enforced by the upload service
  // through serviceContext below; write-mode impersonation is audited here.
  await auditImpersonatedRequest(
    session,
    ctx.workspace._id,
    `PUT /api/imports/${id}`,
  );
  const store = importStore();
  if (!store) return failure("unavailable", 503);
  const maximum = 10 * 1024 * 1024;
  if (Number(request.headers.get("content-length")) > maximum)
    return failure("file_too_large", 413);
  if (!request.body) return failure("invalid_size", 400);
  const reader = request.body.getReader(),
    chunks: Uint8Array[] = [];
  let length = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.length;
      if (length > maximum) {
        await reader.cancel();
        return failure("file_too_large", 413);
      }
      chunks.push(value);
    }
    const body = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) {
      body.set(chunk, offset);
      offset += chunk.length;
    }
    const result = await uploadImportSource(
      await serviceContext(workspace),
      id,
      body,
      store.put,
    );
    return result.ok
      ? new Response(null, { status: 204 })
      : failure(result.error, result.error === "not_found" ? 404 : 409);
  } catch {
    return failure("failed", 502);
  } finally {
    reader.releaseLock();
  }
}
