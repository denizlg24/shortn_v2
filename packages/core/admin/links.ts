import { collection, linkModerationSchema, type Documents } from "@shortn/db";
import { invalidateLinks, type InvalidationStore } from "@shortn/redis";
import type { ClientSession, Db, Document, ObjectId } from "mongodb";
import { z } from "zod";
import { requestSafetyScan } from "../links/safety-jobs";
import { fail, ok } from "../result";
import {
  linkEventData,
  recordWebhookEvent,
  withMutation,
} from "../webhooks/events";

type Link = Documents["links"];
export type LinkModeration = z.infer<typeof linkModerationSchema>;

export interface LinkModerationDeps {
  db: Db;
  cache: InvalidationStore;
  /** Root link domain, for links without an explicit `domain`. */
  linkDomain: string;
  now?: () => Date;
}

export const takedownInput = linkModerationSchema
  .pick({
    category: true,
    publicNote: true,
    internalNote: true,
    reportIds: true,
    by: true,
  })
  .strict();
export type TakedownInput = z.input<typeof takedownInput>;

const takedownReason = "admin:takedown";
const autoBlockReason = "auto:report-threshold";

/** Takes a link down (23 §3.3): `moderation` records the decision and what
 * to restore, and the legacy-visible fields stop delivery on the redirect,
 * legacy fallback, API views and rescans alike. Mutation only: permission
 * and the write-ahead audit row belong to the admin action (B1/D2). */
export async function takedownLink(
  deps: LinkModerationDeps,
  linkId: ObjectId,
  raw: TakedownInput,
) {
  const parsed = takedownInput.safeParse(raw);
  if (!parsed.success) return fail("invalid_input" as const);
  const now = deps.now?.() ?? new Date();
  const result = await withMutation(deps.db, async (session) => {
    const link = await collection(deps.db, "links").findOne(
      { _id: linkId },
      { session },
    );
    if (!link) return fail("not_found" as const);
    if (link.moderation) return fail("already_taken_down" as const);
    const moderation: LinkModeration = {
      state: "taken_down",
      ...parsed.data,
      at: now,
      previous: {
        disabled: Boolean(link.disabled),
        ...(typeof link.safetyStatus === "string"
          ? { safetyStatus: link.safetyStatus }
          : {}),
        ...(typeof link.disabledReason === "string"
          ? { disabledReason: link.disabledReason }
          : {}),
      },
    };
    const saved = await collection(deps.db, "links").findOneAndUpdate(
      { _id: link._id, moderation: { $exists: false } },
      {
        $set: {
          moderation,
          disabled: true,
          disabledReason: takedownReason,
          safetyStatus: "blocked",
          "safety.disabled": true,
          "safety.status": "blocked",
          "safety.disabledReason": takedownReason,
          updatedAt: now,
        },
      },
      { session, returnDocument: "after" },
    );
    if (!saved) return fail("already_taken_down" as const);
    await linkUpdated(deps, saved, session, now);
    return ok(saved);
  });
  if (!result.ok) return result;
  await invalidate(deps, result.value);
  return ok({ previous: result.value.moderation?.previous ?? null });
}

/** Undoes a takedown exactly, then queues a rescan so the destination's
 * current verdict decides what happens next. */
export async function restoreLink(deps: LinkModerationDeps, linkId: ObjectId) {
  const now = deps.now?.() ?? new Date();
  const result = await withMutation(deps.db, async (session) => {
    const link = await collection(deps.db, "links").findOne(
      { _id: linkId },
      { session },
    );
    if (!link) return fail("not_found" as const);
    const moderation = link.moderation;
    if (!moderation) return fail("not_taken_down" as const);
    const { previous } = moderation;
    const safetyStatus = previous.safetyStatus ?? "pending";
    const update: Document = previous.disabled
      ? {
          $set: {
            disabled: true,
            safetyStatus,
            "safety.disabled": true,
            "safety.status": safetyStatus,
            ...(previous.disabledReason
              ? {
                  disabledReason: previous.disabledReason,
                  "safety.disabledReason": previous.disabledReason,
                }
              : {}),
            safetyScan: requestSafetyScan(now),
            updatedAt: now,
          },
          $unset: {
            moderation: "",
            ...(previous.disabledReason
              ? {}
              : { disabledReason: "", "safety.disabledReason": "" }),
          },
        }
      : {
          $set: {
            disabled: false,
            safetyStatus,
            "safety.disabled": false,
            "safety.status": safetyStatus,
            safetyScan: requestSafetyScan(now),
            updatedAt: now,
          },
          $unset: {
            moderation: "",
            disabledReason: "",
            "safety.disabledReason": "",
          },
        };
    const saved = await collection(deps.db, "links").findOneAndUpdate(
      { _id: link._id, "moderation.at": moderation.at },
      update,
      { session, returnDocument: "after" },
    );
    if (!saved) return fail("not_taken_down" as const);
    await linkUpdated(deps, saved, session, now);
    return ok({ link: saved, previous });
  });
  if (!result.ok) return result;
  await invalidate(deps, result.value.link);
  return ok({ restored: result.value.previous });
}

/** "Dismiss + restore" for a link the report threshold disabled: only an
 * automatic block is lifted, and the report counters start over. */
export async function clearAutoBlock(
  deps: LinkModerationDeps,
  linkId: ObjectId,
) {
  const now = deps.now?.() ?? new Date();
  const result = await withMutation(deps.db, async (session) => {
    const saved = await collection(deps.db, "links").findOneAndUpdate(
      {
        _id: linkId,
        moderation: { $exists: false },
        disabledReason: autoBlockReason,
      },
      {
        $set: {
          disabled: false,
          flagged: false,
          safetyStatus: "pending",
          reportCount: 0,
          "safety.disabled": false,
          "safety.flagged": false,
          "safety.status": "pending",
          "safety.reportCount": 0,
          safetyScan: requestSafetyScan(now),
          updatedAt: now,
        },
        $unset: { disabledReason: "", "safety.disabledReason": "" },
      },
      { session, returnDocument: "after" },
    );
    if (!saved) return fail("not_auto_blocked" as const);
    await linkUpdated(deps, saved, session, now);
    return ok(saved);
  });
  if (!result.ok) return result;
  await invalidate(deps, result.value);
  return ok(null);
}

async function linkUpdated(
  deps: LinkModerationDeps,
  link: Link,
  session: ClientSession,
  now: Date,
) {
  const workspaceId =
    link.workspaceId ??
    (link.sub
      ? (
          await collection(deps.db, "workspaces").findOne(
            { personal: true, legacySub: link.sub },
            { session, projection: { _id: 1 } },
          )
        )?._id
      : undefined);
  if (!workspaceId) return;
  await recordWebhookEvent(
    deps.db,
    workspaceId,
    "link.updated",
    {
      ...linkEventData(link, deps.linkDomain),
      moderation: link.moderation
        ? { state: link.moderation.state, category: link.moderation.category }
        : null,
    },
    session,
    now,
  );
}

// The change-stream invalidator only knows the root domain (F7), so a
// custom-domain link has to be evicted here by its own domain.
async function invalidate(deps: LinkModerationDeps, link: Link) {
  await invalidateLinks(deps.cache, link.domain ?? deps.linkDomain, [
    link.key ?? "",
    link.urlCode ?? "",
    ...(link.previousKeys ?? []),
  ]);
}
