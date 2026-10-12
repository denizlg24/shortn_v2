import { loadEntitlements, paidStatuses } from "@shortn/billing";
import { collection, physicalNames } from "@shortn/db";
import { invalidateLinks } from "@shortn/redis";
import { ObjectId, type Db, type Document } from "mongodb";
import { z } from "zod";
import { fail, ok } from "../result";
import { can } from "../workspaces/authz";
import { parseObjectId } from "../workspaces/service";
import { nowOf, type ServiceContext } from "../workspaces/context";
import { ownedBioDocument, bioOutboxCollection } from "../bio/publishing";

export const domainAddonsCollection = physicalNames.domain_addons;
export interface HostnameState {
  id: string;
  status: string;
  ssl: {
    status: string;
    validation_records?: { txt_name?: string; txt_value?: string }[];
  };
  ownership_verification?: { type: string; name: string; value: string };
  verification_errors?: string[];
}
export interface DomainProvider {
  add(hostname: string): Promise<HostnameState>;
  get(id: string): Promise<HostnameState>;
  find(hostname: string): Promise<HostnameState | null>;
  remove(id: string): Promise<void>;
}
export function cloudflareDomains(
  zoneId: string,
  token: string,
  request: typeof fetch = fetch,
): DomainProvider {
  const base = `https://api.cloudflare.com/client/v4/zones/${encodeURIComponent(zoneId)}/custom_hostnames`;
  async function call(path: string, method: string, body?: unknown) {
    const response = await request(base + path, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(15000),
    });
    if (method === "DELETE" && response.status === 404) return null;
    const data = (await response.json()) as {
      success: boolean;
      result: unknown;
    };
    if (!response.ok || !data.success)
      throw new Error(
        `Cloudflare hostname request failed (${response.status})`,
      );
    return data.result;
  }
  return {
    add: async (hostname) =>
      (await call("", "POST", {
        hostname,
        ssl: { method: "http", type: "dv" },
      })) as HostnameState,
    get: async (id) =>
      (await call(`/${encodeURIComponent(id)}`, "GET")) as HostnameState,
    find: async (hostname) =>
      (
        (await call(
          `?hostname=${encodeURIComponent(hostname)}`,
          "GET",
        )) as HostnameState[]
      )[0] ?? null,
    remove: async (id) => {
      await call(`/${encodeURIComponent(id)}`, "DELETE");
    },
  };
}
export function normalizeDomain(
  input: string,
  platformDomain: string,
): string | null {
  try {
    const value = input.trim().toLowerCase();
    if (/[/:@?#*\s]/.test(value) || value.endsWith(".")) return null;
    const host = new URL(`https://${value}`).hostname;
    if (
      host.length > 253 ||
      !host.includes(".") ||
      /^[\d.]+$/.test(host) ||
      host === platformDomain ||
      host.endsWith(`.${platformDomain}`) ||
      !host
        .split(".")
        .every((label) => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label))
    )
      return null;
    return host;
  } catch {
    return null;
  }
}
export async function domainAllowance(db: Db, workspaceId: ObjectId) {
  const plan = await loadEntitlements(db, workspaceId);
  if (plan.plan === "free") return 0;
  const subscriptions = await db
    .collection(domainAddonsCollection)
    .find({ workspaceId, status: { $in: [...paidStatuses] } })
    .toArray();
  return subscriptions.length;
}
const addDomainSchema = z.object({
  hostname: z.string().max(253),
  kind: z.enum(["links", "bio", "both"]),
  bioPageId: z
    .string()
    .regex(/^[a-f\d]{24}$/i)
    .optional(),
  rootRedirect: z.httpUrl().optional(),
  notFoundRedirect: z.httpUrl().optional(),
});
export async function addDomain(
  ctx: ServiceContext,
  input: unknown,
  platformDomain: string,
) {
  if (!can(ctx.actor, "billing.manage")) return fail("forbidden" as const);
  const checked = addDomainSchema.safeParse(input);
  if (!checked.success) return fail("invalid_input" as const);
  const hostname = normalizeDomain(checked.data.hostname, platformDomain);
  if (!hostname) return fail("invalid_hostname" as const);
  if (
    checked.data.kind !== "links" &&
    (!checked.data.bioPageId ||
      !(await ownedBioDocument(ctx, checked.data.bioPageId)))
  )
    return fail("bio_not_found" as const);
  if (
    checked.data.bioPageId &&
    (await ctx.db
      .collection(physicalNames.domains)
      .findOne({
        bioPageId: new ObjectId(checked.data.bioPageId),
        status: { $ne: "disabled" },
      }))
  )
    return fail("bio_domain_taken" as const);
  const allowance = await domainAllowance(ctx.db, ctx.workspace._id);
  const count = await collection(ctx.db, "domains").countDocuments({
    workspaceId: ctx.workspace._id,
    status: { $ne: "disabled" },
  });
  if (count >= allowance) return fail("addon_required" as const);
  const addons = await ctx.db
    .collection(domainAddonsCollection)
    .find({
      workspaceId: ctx.workspace._id,
      status: { $in: [...paidStatuses] },
    })
    .toArray();
  const used = await ctx.db
    .collection(physicalNames.domains)
    .distinct("addonSubscriptionId", {
      workspaceId: ctx.workspace._id,
      status: { $ne: "disabled" },
    });
  const slot = addons.find(
    (addon) => !used.includes(addon.polarSubscriptionId),
  );
  if (!slot) return fail("addon_required" as const);
  const now = nowOf(ctx);
  // Reserve before calling a paid provider. The polling job retries uncertain requests by hostname.
  try {
    const result = await ctx.db
      .collection(physicalNames.domains)
      .insertOne({
        ...checked.data,
        hostname,
        ...(checked.data.bioPageId
          ? { bioPageId: new ObjectId(checked.data.bioPageId) }
          : {}),
        workspaceId: ctx.workspace._id,
        addonSubscriptionId: slot.polarSubscriptionId,
        status: "pending",
        verification: { type: "cname" },
        attempts: 0,
        nextAttemptAt: now,
        createdAt: now,
        updatedAt: now,
      });
    return ok({ id: String(result.insertedId) });
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === 11000)
      return fail("hostname_taken" as const);
    throw error;
  }
}
export async function listDomains(
  ctx: Pick<ServiceContext, "db" | "workspace">,
) {
  const domains = await ctx.db
    .collection(physicalNames.domains)
    .find({ workspaceId: ctx.workspace._id })
    .sort({ createdAt: -1 })
    .toArray();
  return domains.map((d) => ({
    id: String(d._id),
    hostname: String(d.hostname),
    kind: String(d.kind),
    status: String(d.status),
    error: String(d.lastError ?? ""),
    verification: d.verification as {
      type: string;
      name?: string;
      value?: string;
    },
    validationRecords: (d.validationRecords ?? []) as {
      txt_name?: string;
      txt_value?: string;
    }[],
    removing: d.removing === true,
    bioPageId: d.bioPageId ? String(d.bioPageId) : undefined,
  }));
}
export async function removeDomain(ctx: ServiceContext, id: string) {
  if (!can(ctx.actor, "billing.manage")) return fail("forbidden" as const);
  const _id = parseObjectId(id);
  if (!_id) return fail("not_found" as const);
  const domain = await ctx.db
    .collection(physicalNames.domains)
    .findOne({ _id, workspaceId: ctx.workspace._id });
  if (!domain) return fail("not_found" as const);
  await ctx.db
    .collection(physicalNames.domains)
    .updateOne(
      { _id, workspaceId: ctx.workspace._id },
      {
        $set: {
          status: "disabled",
          removing: true,
          nextAttemptAt: nowOf(ctx),
          attempts: 0,
        },
        $unset: { addonSubscriptionId: "" },
      },
    );
  await collection(ctx.db, "links").updateMany(
    { domain: domain.hostname, workspaceId: ctx.workspace._id },
    { $set: { domainInactive: true } },
  );
  await ctx.db
    .collection(physicalNames.bio_pages)
    .updateMany(
      { customDomain: domain.hostname, workspaceId: ctx.workspace._id },
      { $unset: { customDomain: "" } },
    );
  if (domain.bioPageId)
    await ctx.db
      .collection(bioOutboxCollection)
      .updateOne(
        { bioPageId: domain.bioPageId },
        {
          $set: {
            oldDomain: domain.hostname,
            updatedAt: nowOf(ctx),
            nextAttemptAt: nowOf(ctx),
            attempts: 0,
          },
        },
        { upsert: true },
      );
  return ok({ id });
}
export async function retryDomain(ctx: ServiceContext, id: string) {
  if (!can(ctx.actor, "billing.manage")) return fail("forbidden" as const);
  const _id = parseObjectId(id);
  if (!_id) return fail("not_found" as const);
  const result = await collection(ctx.db, "domains").updateOne(
    { _id, workspaceId: ctx.workspace._id, status: "failed" },
    {
      $set: {
        status: "pending",
        attempts: 0,
        createdAt: nowOf(ctx),
        nextAttemptAt: nowOf(ctx),
        lastError: "",
      },
    },
  );
  return result.modifiedCount ? ok({ id }) : fail("not_found" as const);
}
export async function moveDomainLinks(ctx: ServiceContext, id: string) {
  if (!can(ctx.actor, "resource.update")) return fail("forbidden" as const);
  const _id = parseObjectId(id);
  if (!_id) return fail("not_found" as const);
  const domain = await ctx.db
    .collection(physicalNames.domains)
    .findOne({ _id, workspaceId: ctx.workspace._id });
  if (!domain) return fail("not_found" as const);
  const links = await collection(ctx.db, "links")
    .find({ domain: domain.hostname, workspaceId: ctx.workspace._id })
    .toArray();
  const moved: string[] = [],
    conflicts: string[] = [];
  for (const link of links) {
    const key = link.key ?? link.urlCode ?? "";
    if (
      await collection(ctx.db, "links").findOne({
        _id: { $ne: link._id },
        $or: [
          { domain: ctx.linkDomain, key },
          { urlCode: key, domain: { $exists: false } },
        ],
      })
    ) {
      conflicts.push(key);
      continue;
    }
    try {
      await collection(ctx.db, "links").updateOne(
        {
          _id: link._id,
          domain: domain.hostname,
          workspaceId: ctx.workspace._id,
        },
        { $set: { domain: ctx.linkDomain, domainInactive: false } },
      );
      moved.push(key);
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === 11000)
        conflicts.push(key);
      else throw error;
    }
  }
  if (moved.length) {
    await invalidateLinks(ctx.cache, ctx.linkDomain, moved);
    await invalidateLinks(ctx.cache, domain.hostname, moved);
  }
  return ok({ moved, conflicts });
}
/** Leases make provisioning and teardown safe with several workers. */
export const domainBackoff = (attempts: number) =>
  Math.min(3600000, 60000 * 2 ** Math.min(6, attempts));
export async function pollDomains(
  db: Db,
  provider: DomainProvider,
  now = new Date(),
) {
  const domains = db.collection(physicalNames.domains);
  const batch = await domains
    .find({
      nextAttemptAt: { $lte: now },
      $or: [{ leaseUntil: { $exists: false } }, { leaseUntil: { $lt: now } }],
    })
    .limit(20)
    .toArray();
  for (const candidate of batch) {
    const lease = crypto.randomUUID();
    const domain = await domains.findOneAndUpdate(
      {
        _id: candidate._id,
        $or: [{ leaseUntil: { $exists: false } }, { leaseUntil: { $lt: now } }],
      },
      { $set: { lease, leaseUntil: new Date(now.getTime() + 60000) } },
      { returnDocument: "after" },
    );
    if (!domain) continue;
    try {
      if (domain.removing) {
        const remote = domain.cfCustomHostnameId
          ? { id: String(domain.cfCustomHostnameId) }
          : await provider.find(String(domain.hostname));
        if (remote) await provider.remove(remote.id);
        await domains.updateOne(
          { _id: domain._id, lease },
          {
            $set: { removing: false },
            $unset: {
              addonSubscriptionId: "",
              nextAttemptAt: "",
              leaseUntil: "",
              lease: "",
            },
          },
        );
        continue;
      }
      if (
        (await domainAllowance(db, domain.workspaceId as ObjectId)) <= 0 ||
        !(await db
          .collection(domainAddonsCollection)
          .findOne({
            polarSubscriptionId: domain.addonSubscriptionId,
            workspaceId: domain.workspaceId,
            status: { $in: [...paidStatuses] },
          }))
      ) {
        await domains.updateOne(
          { _id: domain._id, lease },
          {
            $set: { status: "disabled", removing: true, nextAttemptAt: now },
            $unset: { leaseUntil: "", lease: "" },
          },
        );
        continue;
      }
      const remote = domain.cfCustomHostnameId
        ? await provider.get(String(domain.cfCustomHostnameId))
        : ((await provider.find(String(domain.hostname))) ??
          (await provider.add(String(domain.hostname))));
      const active =
        remote.status === "active" && remote.ssl.status === "active";
      const expired =
        now.getTime() - (domain.createdAt as Date).getTime() > 72 * 3600000;
      const status = active
        ? "active"
        : expired || ["blocked", "deleted", "moved"].includes(remote.status)
          ? "failed"
          : "pending";
      const applied = await domains.updateOne(
        {
          _id: domain._id,
          lease,
          removing: { $ne: true },
          status: { $ne: "disabled" },
        },
        {
          $set: {
            cfCustomHostnameId: remote.id,
            status,
            hostnameStatus: remote.status,
            sslStatus: remote.ssl.status,
            verification: remote.ownership_verification ?? { type: "cname" },
            validationRecords: remote.ssl.validation_records ?? [],
            lastError:
              remote.verification_errors?.join("; ") ??
              (expired ? "verification_timeout" : ""),
            attempts: Number(domain.attempts ?? 0) + 1,
            updatedAt: now,
            nextAttemptAt: new Date(
              now.getTime() +
                (active
                  ? 3600000
                  : domainBackoff(Number(domain.attempts ?? 0))),
            ),
          },
          $unset: { leaseUntil: "", lease: "" },
        },
      );
      if (!applied.matchedCount) continue;
      if (status === "failed")
        await domains.updateOne(
          { _id: domain._id },
          { $unset: { nextAttemptAt: "" } },
        );
      if (active && domain.bioPageId && domain.status !== "active") {
        await db
          .collection(physicalNames.bio_pages)
          .updateOne(
            { _id: domain.bioPageId, workspaceId: domain.workspaceId },
            { $set: { customDomain: domain.hostname } },
          );
        await db
          .collection(bioOutboxCollection)
          .updateOne(
            { bioPageId: domain.bioPageId },
            { $set: { nextAttemptAt: now, attempts: 0 } },
            { upsert: true },
          );
      }
      if (active && domain.status !== "active")
        await db
          .collection(physicalNames.domain_notifications)
          .updateOne(
            { domainId: domain._id },
            {
              $setOnInsert: {
                workspaceId: domain.workspaceId,
                hostname: domain.hostname,
                createdAt: now,
              },
            },
            { upsert: true },
          );
    } catch (error) {
      const expired =
        now.getTime() - (domain.createdAt as Date).getTime() > 72 * 3600000;
      await domains.updateOne(
        { _id: domain._id, lease },
        {
          $set: {
            status: domain.removing
              ? "disabled"
              : expired
                ? "failed"
                : "pending",
            lastError:
              error instanceof Error ? error.message : "provider_unavailable",
            attempts: Number(domain.attempts ?? 0) + 1,
            nextAttemptAt: new Date(
              now.getTime() + domainBackoff(Number(domain.attempts ?? 0)),
            ),
          },
          $unset: { leaseUntil: "", lease: "" },
        },
      );
      if (expired && !domain.removing)
        await domains.updateOne(
          { _id: domain._id },
          { $unset: { nextAttemptAt: "" } },
        );
    }
  }
}
export async function activeDomain(
  db: Db,
  hostname: string,
): Promise<Document | null> {
  const domain = await db
    .collection(physicalNames.domains)
    .findOne({
      hostname,
      status: "active",
      hostnameStatus: "active",
      sslStatus: "active",
      removing: { $ne: true },
    });
  return domain &&
    (await domainAllowance(db, domain.workspaceId as ObjectId)) > 0 &&
    (await db
      .collection(domainAddonsCollection)
      .findOne({
        polarSubscriptionId: domain.addonSubscriptionId,
        workspaceId: domain.workspaceId,
        status: { $in: [...paidStatuses] },
      }))
    ? domain
    : null;
}
/** Move an owned link only after hostname and certificate readiness. */
export async function assignDomainLink(
  ctx: ServiceContext,
  domainId: string,
  linkId: string,
) {
  if (!can(ctx.actor, "resource.update")) return fail("forbidden" as const);
  const _id = parseObjectId(domainId),
    linkObjectId = parseObjectId(linkId);
  if (!_id || !linkObjectId) return fail("not_found" as const);
  const domain = await ctx.db
    .collection(physicalNames.domains)
    .findOne({ _id, workspaceId: ctx.workspace._id });
  if (
    !domain ||
    domain.kind === "bio" ||
    !(await activeDomain(ctx.db, String(domain.hostname)))
  )
    return fail("domain_inactive" as const);
  const link = await ctx.db
    .collection(physicalNames.links)
    .findOne({ _id: linkObjectId, workspaceId: ctx.workspace._id });
  if (!link) return fail("not_found" as const);
  const key = String(link.key ?? link.urlCode);
  const collision = await ctx.db
    .collection(physicalNames.links)
    .findOne({
      _id: { $ne: link._id },
      domain: domain.hostname,
      $or: [{ key }, { previousKeys: key }],
    });
  if (collision) return fail("key_taken" as const);
  try {
    await ctx.db
      .collection(physicalNames.links)
      .updateOne(
        { _id: link._id, workspaceId: ctx.workspace._id },
        {
          $set: {
            domain: domain.hostname,
            domainInactive: false,
            updatedAt: nowOf(ctx),
          },
        },
      );
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === 11000)
      return fail("key_taken" as const);
    throw error;
  }
  await invalidateLinks(ctx.cache, String(link.domain ?? ctx.linkDomain), [
    key,
  ]);
  await invalidateLinks(ctx.cache, String(domain.hostname), [key]);
  for (const page of await ctx.db
    .collection(physicalNames.bio_pages)
    .find(
      {
        workspaceId: ctx.workspace._id,
        $or: [
          { "publishedContent.blocks.linkId": linkId },
          { "publishedContent.blocks.items.linkId": linkId },
        ],
      },
      { projection: { _id: 1 } },
    )
    .toArray()) {
    await ctx.db
      .collection(bioOutboxCollection)
      .updateOne(
        { bioPageId: page._id },
        {
          $set: {
            updatedAt: nowOf(ctx),
            nextAttemptAt: nowOf(ctx),
            attempts: 0,
          },
        },
        { upsert: true },
      );
  }
  return ok({ key, hostname: String(domain.hostname) });
}
