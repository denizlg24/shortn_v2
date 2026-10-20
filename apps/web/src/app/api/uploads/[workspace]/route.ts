import { randomUUID } from "node:crypto";
import { hasFeature, loadEntitlements } from "@shortn/billing";
import { workspaceContext } from "@shortn/core";
import { getSession } from "@/server/auth";
import { db } from "@/server/db";
import { env } from "@/server/env";
import { storage, assetUrl } from "@/server/storage";
import {
  boundedUploadBody,
  imageForStorage,
  maxImageBytes,
  uploadAllowed,
  uploadPurposes,
} from "@/server/upload-image";
import {
  auditImpersonatedRequest,
  withImpersonation,
} from "@/server/workspace";

export const runtime = "nodejs";
const failure = (error: string, status: number) =>
  Response.json({ error }, { status });

export async function POST(
  request: Request,
  { params }: { params: Promise<{ workspace: string }> },
) {
  const origin = request.headers.get("origin");
  if (
    origin &&
    origin !== new URL(env().BETTER_AUTH_URL).origin &&
    origin !== new URL(request.url).origin
  )
    return failure("forbidden", 403);
  const session = await getSession();
  if (!session) return failure("unauthenticated", 401);
  const { workspace: slug } = await params;
  const database = await db();
  const ctx = await workspaceContext(database, session.user.id, slug);
  const purpose = uploadPurposes.find(
    (item) => item === new URL(request.url).searchParams.get("purpose"),
  );
  if (!purpose) return failure("invalid", 400);
  if (!ctx || !uploadAllowed(withImpersonation(session, ctx.actor), purpose))
    return failure("forbidden", 403);
  await auditImpersonatedRequest(
    session,
    ctx.workspace._id,
    `POST /api/uploads?purpose=${purpose}`,
  );
  if (
    purpose === "qr-logo" &&
    !hasFeature(await loadEntitlements(database, ctx.workspace), "qrLogo")
  )
    return failure("plan", 403);
  const store = storage();
  if (!store) return failure("unavailable", 503);
  let body: Buffer;
  try {
    const form = await boundedUploadBody(request);
    const file = form.get("file");
    if (!(file instanceof File)) return failure("type", 400);
    if (file.size > maxImageBytes) return failure("size", 413);
    body = await imageForStorage(new Uint8Array(await file.arrayBuffer()));
  } catch (error) {
    return failure(
      error instanceof Error && error.message === "size" ? "size" : "type",
      error instanceof Error && error.message === "size" ? 413 : 400,
    );
  }
  const key = `uploads/workspaces/${ctx.workspace._id.toHexString()}/${randomUUID()}.png`;
  try {
    await store.put(key, body);
  } catch {
    return failure("failed", 502);
  }
  return Response.json(
    { url: assetUrl(key) },
    { headers: { "cache-control": "no-store" } },
  );
}
