"use server";
import { ObjectId } from "mongodb";
import { z } from "zod";
import { redirect } from "next/navigation";
import { destinationHostRev, physicalNames } from "@shortn/db";
import {
  adminDenial,
  bulkLimits,
  consoleMutation,
  enqueuePlatformNotification,
} from "@shortn/core";
import { adminContext } from "./session";
import { authorize } from "./authorize";
import { textOf, reasonOf, type ActionState } from "./action";

export async function freezeLinks(
  _previous: ActionState,
  form: FormData,
): Promise<ActionState> {
  const ctx = await adminContext();
  const cap = bulkLimits[ctx.admin.role];
  let ids: string[];
  const host = textOf(form, "host");
  if (host) {
    if (ctx.admin.role !== "superadmin")
      return { error: "Host-wide takedown requires superadmin." };
    const reversed = destinationHostRev(`https://${host}`);
    if (!reversed) return { error: "Enter a valid destination hostname." };
    const regex = new RegExp(
      `^${reversed.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:\\.|$)`,
    );
    ids = (
      await ctx.db
        .collection(physicalNames.links)
        .find({ destHostRev: regex }, { projection: { _id: 1 } })
        .limit(cap + 1)
        .toArray()
    ).map((r) => String(r._id));
  } else {
    let value: unknown;
    try {
      value = JSON.parse(String(form.get("ids") ?? "[]"));
    } catch {
      return { error: "Invalid selection." };
    }
    const parsed = z
      .array(z.string().regex(/^[a-f\d]{24}$/i))
      .min(1)
      .max(cap)
      .safeParse(value);
    if (!parsed.success) return { error: `Select between 1 and ${cap} links.` };
    ids = [...new Set(parsed.data)];
  }
  if (!ids.length || ids.length > cap)
    return {
      error: `This matches ${ids.length > cap ? `more than ${cap}` : "no"} links. Narrow the selection.`,
    };
  const key = crypto.randomUUID();
  await ctx.db
    .collection<{
      _id: string;
      userId: string;
      ids: string[];
      expiresAt: Date;
      host?: string;
    }>(physicalNames.admin_bulk_selections)
    .insertOne({
      _id: key,
      userId: ctx.admin.id,
      ids,
      expiresAt: new Date(Date.now() + 10 * 60000),
      ...(host ? { host } : {}),
    });
  redirect(`/links/bulk?selection=${key}`);
}
export async function applyBulk(
  selection: string,
  _previous: ActionState,
  form: FormData,
): Promise<ActionState> {
  const permission = await authorize("link.takedown", {
    reason: reasonOf(form),
  });
  if (!permission.ok) return { error: permission.error };
  const ctx = permission.value;
  const selections = ctx.db.collection<{
    _id: string;
    userId: string;
    ids: string[];
    expiresAt: Date;
    host?: string;
    claimedAt?: Date;
  }>(physicalNames.admin_bulk_selections);
  const snapshot = await selections.findOne({
    _id: selection,
    userId: ctx.admin.id,
    expiresAt: { $gt: ctx.now() },
    claimedAt: { $exists: false },
  });
  if (!snapshot)
    return {
      error:
        "This confirmation has expired or was already submitted. Freeze a new selection.",
    };
  if (snapshot.ids.length > bulkLimits[ctx.admin.role])
    return { error: "Selection exceeds your operation limit." };
  if (snapshot.ids.length > 100 || snapshot.host) {
    const denial = adminDenial(
      { role: ctx.admin.role, elevatedAt: ctx.session.elevatedAt },
      "link.takedown.bulk",
      { reason: reasonOf(form), now: ctx.now() },
    );
    if (denial) return { error: denial };
  }
  if (textOf(form, "confirm") !== String(snapshot.ids.length))
    return { error: `Type ${snapshot.ids.length} to confirm.` };
  const operation = textOf(form, "operation");
  if (!["takedown", "restore"].includes(operation))
    return { error: "Choose a valid operation." };
  const claimed = await selections.updateOne(
    { _id: selection, claimedAt: { $exists: false } },
    { $set: { claimedAt: ctx.now() } },
  );
  if (!claimed.modifiedCount)
    return { error: "This operation was already submitted." };
  const outcomes = [];
  for (const id of snapshot.ids) {
    try {
      const result = await consoleMutation(
        ctx,
        "links",
        id,
        operation,
        {
          suppressNotice: "yes",
          category: textOf(form, "category"),
          publicNote: textOf(form, "publicNote"),
        },
        reasonOf(form),
      );
      outcomes.push({
        id,
        ok: result.ok,
        error: result.ok ? null : result.error,
      });
    } catch {
      outcomes.push({ id, ok: false, error: "operation_failed" });
    }
  }
  if (operation === "takedown") {
    const links = await ctx.db
      .collection(physicalNames.links)
      .find(
        {
          _id: {
            $in: outcomes.filter((o) => o.ok).map((o) => new ObjectId(o.id)),
          },
        },
        { projection: { workspaceId: 1, key: 1, domain: 1 } },
      )
      .limit(1000)
      .toArray();
    const groups = new Map<string, typeof links>();
    for (const link of links) {
      if (!link.workspaceId) continue;
      const id = String(link.workspaceId);
      groups.set(id, [...(groups.get(id) ?? []), link]);
    }
    for (const [workspaceId, items] of groups) {
      const workspace = await ctx.db
        .collection(physicalNames.workspaces)
        .findOne({ _id: new ObjectId(workspaceId) });
      const owner =
        workspace && ObjectId.isValid(String(workspace.ownerUserId))
          ? await ctx.db
              .collection(physicalNames.user)
              .findOne({ _id: new ObjectId(String(workspace.ownerUserId)) })
          : null;
      if (owner?.email && workspace)
        await enqueuePlatformNotification(ctx.db, {
          key: `bulk-link-removed:${selection}:${workspaceId}`,
          kind: "linkRemoved",
          to: String(owner.email),
          payload: {
            workspaceName: String(workspace.name),
            workspaceSlug: String(workspace.slug),
            links: items.map((link) => ({
              shortUrl: `https://${link.domain ?? ctx.linkDomain}/${link.key}`,
              category: textOf(form, "category"),
            })),
          },
          now: ctx.now(),
        });
    }
  }
  await ctx.db
    .collection(physicalNames.admin_bulk_selections)
    .updateOne(
      { _id: selection as never },
      { $set: { outcomes, completedAt: ctx.now() } },
    );
  redirect(`/links/bulk?selection=${selection}`);
}
