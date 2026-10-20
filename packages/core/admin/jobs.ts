import { collection, physicalNames } from "@shortn/db";
import type { InvalidationStore } from "@shortn/redis";
import { ObjectId, type Db, type Document } from "mongodb";
import { cancelImport, importJobs, type ImportState } from "../imports/jobs";
import { fail, ok } from "../result";
import { deliveries } from "../webhooks/service";

/** Job types the admin Jobs page acts on (23 §3.11). Link, analytics and
 * workspace exports share `export_jobs`. */
export const adminJobKinds = [
  "export",
  "qr_export",
  "qr_zip",
  "import",
  "webhook_delivery",
  "billing_event",
  "bio_delivery",
] as const;
export type AdminJobKind = (typeof adminJobKinds)[number];

export interface JobDeps {
  db: Db;
  cache: InvalidationStore;
  linkDomain: string;
  now?: () => Date;
}

// A lease older than this is stuck rather than slow.
const stuckAfterMs = 5 * 60_000;

const leased = {
  export: physicalNames.export_jobs,
  qr_export: physicalNames.qr_export_jobs,
  qr_zip: physicalNames.qr_zip_jobs,
} as const;

const objectId = (id: string) =>
  /^[a-f\d]{24}$/i.test(id) ? new ObjectId(id) : null;

/** Failed → pending with a fresh attempt budget. Outputs are keyed by job, so
 * a retry overwrites rather than duplicates. Imports aren't retryable: quota
 * reservations and generations make a blind retry unsafe. */
export async function retryJob(deps: JobDeps, kind: AdminJobKind, id: string) {
  const now = deps.now?.() ?? new Date();
  if (kind === "billing_event") {
    const result = await collection(deps.db, "billing_events").updateOne(
      { _id: id, processedAt: { $exists: false } },
      { $set: { attempts: 0 }, $unset: { lockedUntil: "", error: "" } },
    );
    return result.matchedCount ? ok(null) : fail("not_found" as const);
  }
  const _id = objectId(id);
  if (!_id) return fail("not_found" as const);
  if (kind === "import") return fail("not_retryable" as const);
  if (kind === "bio_delivery") {
    const result = await deps.db
      .collection(physicalNames.bio_delivery_jobs)
      .updateOne({ _id }, { $set: { nextAttemptAt: now } });
    return result.matchedCount ? ok(null) : fail("not_found" as const);
  }
  if (kind === "webhook_delivery") {
    const result = await deliveries(deps.db).updateOne(
      { _id, status: "failed" },
      {
        $set: {
          status: "pending",
          nextAttemptAt: now,
          retryUntil: new Date(now.getTime() + 86_400_000),
        },
        $unset: { leaseToken: "", leaseUntil: "" },
      },
    );
    return result.modifiedCount ? ok(null) : fail("not_failed" as const);
  }
  const result = await deps.db.collection(leased[kind]).updateOne(
    { _id, state: "failed" },
    {
      $set: { state: "pending", attempts: 0, nextAttemptAt: now },
      $unset: { error: "", leaseToken: "", leaseUntil: "" },
    },
  );
  return result.modifiedCount ? ok(null) : fail("not_failed" as const);
}

/** Only state machines with a `cancelled` state can be cancelled: exports,
 * imports (through the owner path, which releases its quota) and webhook
 * deliveries. QR export and zip jobs have no cancelled state. */
export async function cancelJob(
  deps: JobDeps,
  kind: AdminJobKind,
  id: string,
  adminId: string,
) {
  const _id = objectId(id);
  if (!_id) return fail("not_found" as const);
  if (kind === "export") {
    const result = await deps.db
      .collection(physicalNames.export_jobs)
      .updateOne(
        { _id, state: { $in: ["pending", "running"] } },
        {
          $set: { state: "cancelled" },
          $unset: { leaseToken: "", leaseUntil: "" },
        },
      );
    return result.modifiedCount ? ok(null) : fail("not_cancellable" as const);
  }
  if (kind === "webhook_delivery") {
    const result = await deliveries(deps.db).updateOne(
      { _id, status: { $in: ["pending", "sending"] } },
      {
        $set: { status: "cancelled", lastError: "cancelled_by_staff" },
        $unset: { leaseToken: "", leaseUntil: "" },
      },
    );
    return result.modifiedCount ? ok(null) : fail("not_cancellable" as const);
  }
  if (kind === "import") {
    const job = await importJobs(deps.db).findOne({ _id });
    const workspace = job
      ? await collection(deps.db, "workspaces").findOne({
          _id: job.workspaceId,
        })
      : null;
    if (!job || !workspace) return fail("not_found" as const);
    // The owner path releases the quota reservation in the same transaction;
    // staff act as the job's creator, attributed through `via`.
    const cancelled = await cancelImport(
      {
        db: deps.db,
        cache: deps.cache,
        linkDomain: deps.linkDomain,
        workspace,
        actor: {
          userId: job.createdBy,
          role: "owner",
          via: { kind: "platform", adminId },
        },
        ...(deps.now ? { now: deps.now } : {}),
      },
      id,
    );
    return cancelled ? ok(null) : fail("not_cancellable" as const);
  }
  return fail("not_cancellable" as const);
}

const pendingState: Partial<Record<ImportState, ImportState>> = {
  inspecting: "inspect_pending",
  validating: "validate_pending",
  committing: "commit_pending",
};

/** Puts a job whose worker vanished back in its queue. Workers reclaim
 * `leaseUntil <= now` only while one is running, and a bare unset would make
 * a running job unclaimable, so the job returns to its pending state with
 * the lease cleared; the old worker's fenced writes then fail. */
export async function requeueStuckJob(
  deps: JobDeps,
  kind: AdminJobKind,
  id: string,
) {
  const _id = objectId(id);
  if (!_id) return fail("not_found" as const);
  const now = deps.now?.() ?? new Date();
  const stuck = { $lt: new Date(now.getTime() - stuckAfterMs) };
  const release: Document = { $unset: { leaseToken: "", leaseUntil: "" } };
  if (kind === "webhook_delivery") {
    const result = await deliveries(deps.db).updateOne(
      { _id, status: "sending", leaseUntil: stuck },
      { ...release, $set: { status: "pending", nextAttemptAt: now } },
    );
    return result.modifiedCount ? ok(null) : fail("not_stuck" as const);
  }
  if (kind === "import") {
    const job = await importJobs(deps.db).findOne({ _id, leaseUntil: stuck });
    const next = job ? pendingState[job.state] : undefined;
    if (!job || !next) return fail("not_stuck" as const);
    const result = await importJobs(deps.db).updateOne(
      { _id, state: job.state, leaseUntil: stuck },
      { ...release, $set: { state: next, nextAttemptAt: now } },
    );
    return result.modifiedCount ? ok(null) : fail("not_stuck" as const);
  }
  if (kind === "export" || kind === "qr_export" || kind === "qr_zip") {
    const result = await deps.db
      .collection(leased[kind])
      .updateOne(
        { _id, state: "running", leaseUntil: stuck },
        { ...release, $set: { state: "pending", nextAttemptAt: now } },
      );
    return result.modifiedCount ? ok(null) : fail("not_stuck" as const);
  }
  return fail("not_leased" as const);
}
