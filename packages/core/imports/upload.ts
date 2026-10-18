import { createHash } from "node:crypto";
import { physicalNames } from "@shortn/db";
import { can } from "../workspaces/authz";
import { nowOf, type ServiceContext } from "../workspaces/context";
import { fail } from "../result";
import { getImportJob, inspectImport } from "./jobs";
import { importLimits } from "./csv";

/** Same-origin fallback for gateways without CORS or conditional PUT support. */
export async function uploadImportSource(
  ctx: ServiceContext,
  id: string,
  bytes: Uint8Array,
  put: (key: string, bytes: Uint8Array, contentType: string) => Promise<void>,
) {
  const job = await getImportJob(ctx, id);
  if (
    !job ||
    job.createdBy !== ctx.actor.userId ||
    !can(ctx.actor, "resource.create")
  )
    return fail("not_found" as const);
  if (bytes.length !== job.bytes || bytes.length > importLimits.bytes)
    return fail("invalid_size" as const);
  const jobs = ctx.db.collection(physicalNames.import_jobs);
  // A claim is never released: an interrupted request needs a fresh job, so a
  // stale writer can never overwrite the source used by a replacement request.
  const claim = await jobs.updateOne(
    { _id: job._id, state: "uploading", uploadClaimedAt: { $exists: false } },
    {
      $set: {
        uploadClaimedAt: nowOf(ctx),
        sourceHash: createHash("sha256").update(bytes).digest("hex"),
      },
    },
  );
  if (!claim.modifiedCount) return fail("invalid_state" as const);
  try {
    await put(job.inputKey, bytes, "text/csv; charset=utf-8");
    return await inspectImport(ctx, id);
  } catch {
    await jobs.updateOne(
      { _id: job._id, state: "uploading" },
      { $set: { state: "failed", error: "storage_unavailable" } },
    );
    return fail("storage_unavailable" as const);
  }
}
