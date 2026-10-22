import { collection, physicalNames } from "@shortn/db";
import {
  deletionPreflight,
  purgeExpiredLinks,
  setWorkspaceSuspension,
  removeDomain,
  bioOutboxCollection,
  enqueuePlatformNotification,
  recordAdminEvent,
  type AdminContext,
} from "@shortn/core";
import type { createPolar } from "@shortn/billing";
import type { ObjectStore } from "@shortn/storage";
import { createHash } from "node:crypto";
import { type Document } from "mongodb";

type Deps = { polarServer?: "sandbox" | "production" } & Omit<
  AdminContext,
  "admin" | "session" | "request"
> & {
    polar?: ReturnType<typeof createPolar> | undefined;
    store?: ObjectStore | undefined;
  };
const dayMs = 86400000;
/** One leased account per tick. External work must finish before its workspace is removed. */
export async function purgeAccount(
  deps: Deps,
  options: { dryRun?: boolean } = {},
) {
  const now = deps.now();
  const users = deps.db.collection(physicalNames.user);
  const due = {
    role: { $nin: ["admin", "superadmin"] },
    "deletion.purgeAfter": { $lte: now },
    "deletion.state": { $in: ["scheduled", "purging"] },
    $or: [
      { "deletion.leaseUntil": { $exists: false } },
      { "deletion.leaseUntil": { $lt: now } },
    ],
  };
  if (options.dryRun) {
    const user = await users.findOne(due);
    return user ? deletionPreflight(deps.db, user._id) : null;
  }
  const lease = crypto.randomUUID();
  const user = await users.findOneAndUpdate(
    due,
    {
      $set: {
        "deletion.state": "purging",
        "deletion.lease": lease,
        "deletion.leaseUntil": new Date(now.getTime() + 5 * 60000),
      },
    },
    { returnDocument: "after", sort: { "deletion.purgeAfter": 1 } },
  );
  if (!user) return null;
  const claim = { _id: user._id, "deletion.lease": lease };
  const renew = async () => {
    const r = await users.updateOne(claim, {
      $set: {
        "deletion.leaseUntil": new Date(deps.now().getTime() + 5 * 60000),
      },
    });
    if (!r.matchedCount) throw new Error("purge_lease_lost");
  };
  const ctx: AdminContext = {
    ...deps,
    admin: { id: "system", email: "system@shortn.at", role: "superadmin" },
    session: { id: lease, elevatedAt: now },
    request: {},
  };
  const counts: Record<string, number> = { ...(user.deletion.counts ?? {}) };
  const erase = async (name: string, filter: Document) => {
    await renew();
    const r = await deps.db.collection(name).deleteMany(filter);
    counts[name] = (counts[name] ?? 0) + r.deletedCount;
    if (r.deletedCount)
      await users.updateOne(claim, {
        $inc: { [`deletion.counts.${name}`]: r.deletedCount },
      });
  };
  try {
    const report = await deletionPreflight(deps.db, user._id);
    if (!report || report.blocked)
      throw new Error("shared_workspaces_require_transfer");
    await recordAdminEvent(ctx, {
      action: "user.delete.purge.started",
      targetType: "user",
      targetId: String(user._id),
      metadata: { workspaces: report.workspaces.map((w) => w.id) },
    });
    const allOwned = await collection(deps.db, "workspaces")
      .find({ ownerUserId: String(user._id) })
      .limit(1001)
      .toArray();
    if (allOwned.length > 1000) throw new Error("too_many_workspaces");
    for (const workspace of allOwned) {
      await renew();
      if (workspace.suspension?.internalNote !== "Account erasure in progress")
        await setWorkspaceSuspension(deps, workspace._id, {
          level: "suspended",
          category: "legal",
          internalNote: "Account erasure in progress",
          by: "system",
          at: now,
        });
      const match = { workspaceId: workspace._id };
      if (workspace.personal && workspace.legacySub) {
        for (const name of [
          physicalNames.links,
          physicalNames.qr_codes,
          physicalNames.campaigns,
          physicalNames.tags,
        ])
          await deps.db
            .collection(name)
            .updateMany(
              { sub: workspace.legacySub, workspaceId: { $exists: false } },
              { $set: { workspaceId: workspace._id } },
            );
        await deps.db
          .collection(physicalNames.bio_pages)
          .updateMany(
            { userId: workspace.legacySub, workspaceId: { $exists: false } },
            { $set: { workspaceId: workspace._id } },
          );
      }

      for (const name of [
        physicalNames.subscriptions,
        physicalNames.domain_addons,
      ])
        for await (const sub of deps.db.collection(name).find({
          ...match,
          status: { $in: ["active", "trialing", "past_due", "unpaid"] },
        })) {
          if (!deps.polar) throw new Error("polar_required_for_paid_workspace");
          const remote = await deps.polar.subscriptions.get({
            id: String(sub.polarSubscriptionId),
          });
          if (!["canceled", "revoked"].includes(remote.status))
            await deps.polar.subscriptions.revoke({
              id: String(sub.polarSubscriptionId),
            });
          // Mark the local snapshot only by applying the authoritative response.
          const { applySubscription } = await import("@shortn/billing");
          await applySubscription(
            deps.db,
            deps.polar,
            deps.polarServer ?? "sandbox",
            String(sub.polarSubscriptionId),
          );
        }
      for await (const domain of deps.db
        .collection(physicalNames.domains)
        .find(match)) {
        if (domain.removing) continue;
        if (domain.status === "disabled" && domain.removing === false) {
          await deps.db
            .collection(physicalNames.domains)
            .deleteOne({ _id: domain._id });
          continue;
        }
        if (domain.status === "suspended")
          await collection(deps.db, "domains").updateOne(
            { _id: domain._id },
            { $set: { status: "pending" }, $unset: { suspension: "" } },
          );
        const result = await removeDomain(
          {
            ...deps,
            workspace,
            actor: { userId: workspace.ownerUserId, role: "owner" },
          },
          String(domain._id),
        );
        if (!result.ok) throw new Error(result.error);
      }
      // The ordinary domain worker and bio invalidator must acknowledge their external work first.
      if (await collection(deps.db, "domains").countDocuments(match))
        throw new Error("waiting_for_domain_removal");
      const pageIds = await collection(deps.db, "bio_pages")
        .find(match, { projection: { _id: 1 } })
        .limit(10001)
        .toArray();
      if (pageIds.length > 10000) throw new Error("bio_page_limit");
      if (
        pageIds.length &&
        (await deps.db
          .collection(bioOutboxCollection)
          .countDocuments({ bioPageId: { $in: pageIds.map((p) => p._id) } }))
      )
        throw new Error("waiting_for_bio_invalidation");
      // Stop writers and wait for their leases before removing stored outputs.
      const jobNames = [
        physicalNames.export_jobs,
        physicalNames.qr_export_jobs,
        physicalNames.qr_zip_jobs,
        physicalNames.import_jobs,
      ];
      for (const name of jobNames) {
        if (
          await deps.db.collection(name).countDocuments({
            ...match,
            state: "running",
            leaseUntil: { $gt: now },
          })
        )
          throw new Error("waiting_for_job_lease");
        await deps.db.collection(name).updateMany(
          { ...match, state: { $in: ["pending", "running", "queued"] } },
          {
            $set: {
              state:
                name === physicalNames.qr_export_jobs ||
                name === physicalNames.qr_zip_jobs
                  ? "failed"
                  : "cancelled",
              error: "account_erasure",
            },
            $unset: { leaseToken: "", leaseUntil: "" },
          },
        );
        for await (const job of deps.db.collection(name).find(match)) {
          for await (const item of deps.db
            .collection(physicalNames.qr_zip_items)
            .find({ jobId: job._id })) {
            if (item.objectKey) {
              if (!deps.store?.delete)
                throw new Error("storage_required_for_purge");
              await deps.store.delete(String(item.objectKey));
            }
          }
          await erase(physicalNames.qr_zip_items, { jobId: job._id });
          const objectKeys = [
            job.objectKey,
            job.uploadKey,
            job.sourceKey,
            job.errorObjectKey,
            job.inputKey,
            job.errorKey,
          ].filter(
            (k): k is string =>
              typeof k === "string" && /^(exports|uploads|imports)\//.test(k),
          );
          if (objectKeys.length && !deps.store?.delete)
            throw new Error("storage_required_for_purge");
          for (const key of objectKeys) await deps.store!.delete!(key);
        }
      }
      const uploadPrefix = `uploads/workspaces/${workspace._id}`;
      let hasUploads = false;
      for (const name of [
        physicalNames.qr_codes,
        physicalNames.bio_pages,
        physicalNames.bio_page_versions,
      ])
        for await (const asset of deps.db.collection(name).find(match)) {
          if (JSON.stringify(asset).includes(uploadPrefix)) hasUploads = true;
        }
      if (hasUploads && !deps.store?.deletePrefix)
        throw new Error("storage_required_for_purge");
      if (deps.store?.deletePrefix) await deps.store.deletePrefix(uploadPrefix);
      await erase(physicalNames.bio_aliases, {
        bioPageId: { $in: pageIds.map((page) => page._id) },
      });
      await erase(physicalNames.bio_page_versions, {
        $or: [match, { bioPageId: { $in: pageIds.map((page) => page._id) } }],
      });
      await erase("clicks_deleted", match);
      const sids: string[] = [];
      for await (const event of deps.db
        .collection(physicalNames.click_events)
        .find({ "m.workspaceId": workspace._id }, { projection: { sid: 1 } })
        .batchSize(500)) {
        if (typeof event.sid === "string") sids.push(event.sid);
        if (sids.length >= 500) {
          await erase(physicalNames.click_ips, {
            sid: { $in: sids.splice(0) },
          });
        }
      }
      if (sids.length)
        await erase(physicalNames.click_ips, { sid: { $in: sids } });
      if (workspace.personal && workspace.legacySub)
        await collection(deps.db, "links").updateMany(
          { sub: workspace.legacySub, workspaceId: { $exists: false } },
          { $set: { workspaceId: workspace._id } },
        );
      await collection(deps.db, "links").updateMany(match, {
        $set: { deletedAt: new Date(now.getTime() - 31 * dayMs) },
      });
      while (await collection(deps.db, "links").countDocuments(match)) {
        await renew();
        const result = await purgeExpiredLinks(deps, now, 100, workspace._id);
        if (!result.purged) throw new Error("links_could_not_be_purged");
      }
      for (const name of [
        physicalNames.qr_codes,
        physicalNames.bio_pages,
        physicalNames.campaigns,
        physicalNames.tags,
        physicalNames.api_keys,
        physicalNames.webhook_endpoints,
        physicalNames.webhook_deliveries,
        physicalNames.webhook_attempts,
        physicalNames.webhook_events,
        physicalNames.webhook_clicks,
        physicalNames.webhook_notifications,
        physicalNames.import_jobs,
        physicalNames.import_rows,
        physicalNames.import_results,
        physicalNames.import_reservations,
        physicalNames.import_receipts,
        physicalNames.export_jobs,
        physicalNames.qr_export_jobs,
        physicalNames.qr_zip_jobs,
        physicalNames.qr_zip_items,
        physicalNames.click_rollups,
        physicalNames.workspace_daily,
        physicalNames.bio_views,
        physicalNames.usage_periods,
        physicalNames.subscriptions,
        physicalNames.domain_addons,
        physicalNames.domain_notifications,
        physicalNames.workspace_members,
        physicalNames.workspace_invites,
        physicalNames.sso_providers,
        physicalNames.audit_log,
      ])
        await erase(name, match);
      await erase(physicalNames.click_events, {
        "m.workspaceId": workspace._id,
      });
      if (workspace.legacySub)
        for (const name of [
          physicalNames.clicks,
          physicalNames.qr_codes,
          physicalNames.bio_pages,
          physicalNames.campaigns,
          physicalNames.tags,
        ])
          await erase(name, { sub: workspace.legacySub });
      if (workspace.legacySub) {
        await erase("clicks_deleted", { sub: workspace.legacySub });
        await erase(physicalNames.scheduled_changes, {
          sub: workspace.legacySub,
        });
      }
      // Workspace stays until all cache and object cleanup above has succeeded.
      await erase(physicalNames.workspaces, { _id: workspace._id });
    }
    const both = { $in: [String(user._id), user._id] };
    for (const name of [
      physicalNames.session,
      physicalNames.account,
      physicalNames.two_factor,
      physicalNames.passkeys,
      physicalNames.sso_bindings,
      physicalNames.sso_link_intents,
      physicalNames.oauth_consents,
      physicalNames.oauth_access_tokens,
      physicalNames.oauth_refresh_tokens,
      physicalNames.handoff_tokens,
      physicalNames.admin_sessions,
      physicalNames.admin_elevation_tokens,
      physicalNames.sign_in_events,
      physicalNames.workspace_members,
    ])
      await erase(name, { userId: both });
    await erase(physicalNames.api_keys, { createdBy: String(user._id) });
    await erase(physicalNames.workspace_invites, {
      $or: [{ email: user.email }, { createdBy: String(user._id) }],
    });
    await erase(physicalNames.verification, {
      $or: [
        { value: String(user._id) },
        { identifier: user.email },
        { identifier: `email-verification:${user.email}` },
      ],
    });
    if (user.sub) await erase(physicalNames.login_records, { sub: user.sub });
    if (typeof user.email === "string")
      await enqueuePlatformNotification(deps.db, {
        key: `account-deleted:${user._id}`,
        kind: "accountDeleted",
        to: user.email,
        payload: {},
        ...(typeof user.locale === "string" ? { locale: user.locale } : {}),
        now,
      });
    await deps.db
      .collection(physicalNames.contacts)
      .updateMany(
        { email: user.email },
        { $set: { gdprRetainUntil: new Date(now.getTime() + 365 * 86400000) } },
      );
    const emailHash = createHash("sha256")
      .update(String(user.email).trim().toLowerCase())
      .digest("hex");
    await collection(deps.db, "admin_audit_log").updateMany(
      { actorId: String(user._id) },
      { $set: { actorEmail: `sha256:${emailHash}` } },
    );
    await collection(deps.db, "admin_audit_log").updateMany(
      { targetType: "user", targetId: String(user._id) },
      {
        $set: { "metadata.emailHash": emailHash },
        $unset: { "metadata.outcome.report.email": "", targetEmail: "" },
      },
    );
    await recordAdminEvent(ctx, {
      action: "user.delete.purge",
      targetType: "user",
      targetId: String(user._id),
      metadata: { counts },
    });
    const final = await users.replaceOne(claim, {
      _id: user._id,
      deletedAt: now,
      emailHash: createHash("sha256")
        .update(String(user.email).trim().toLowerCase())
        .digest("hex"),
      deletion: { state: "done" },
    });
    if (!final.matchedCount) throw new Error("purge_lease_lost");
    return { purged: String(user._id), counts };
  } catch (error) {
    await users.updateOne(claim, {
      $set: {
        "deletion.error":
          error instanceof Error ? error.message : "purge_failed",
        "deletion.leaseUntil": new Date(deps.now().getTime() + 60000),
      },
      $unset: { "deletion.lease": "" },
    });
    throw error;
  }
}
