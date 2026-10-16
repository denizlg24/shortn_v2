"use server";

import { z } from "zod";
import {
  can,
  prepareImportUpload,
  completeImportUpload,
  getImportJob,
  importErrorDelivery,
  validateImport,
  commitImport,
  cancelImport,
  listImportJobs,
  listImportResults,
  searchImportTags,
} from "@shortn/core";
import { serviceContext } from "../context";
import { importStore } from "../imports";

const metadata = z
  .object({ bytes: z.number().int().positive(), kind: z.enum(["links", "qr"]) })
  .strict();
const mapping = z.partialRecord(
  z.enum([
    "url",
    "key",
    "title",
    "tags",
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "utm_term",
    "utm_content",
    "expires_at",
    "domain",
  ]),
  z.number().int().nonnegative(),
);
const rowQuery = z
  .object({
    page: z.number().int().positive().optional(),
    search: z.string().max(200).optional(),
    tag: z.string().max(64).optional(),
    status: z.enum(["all", "valid", "invalid"]).optional(),
    error: z.string().max(64).optional(),
    group: z.enum(["error", "none"]).optional(),
  })
  .strict();
const historyQuery = z
  .object({
    page: z.number().int().positive().optional(),
    kind: z.enum(["links", "qr"]).optional(),
    state: z
      .enum([
        "uploading",
        "inspect_pending",
        "inspecting",
        "mapping",
        "validate_pending",
        "validating",
        "ready",
        "commit_pending",
        "committing",
        "completed",
        "failed",
        "cancelled",
      ])
      .optional(),
  })
  .strict();

export async function prepareImportUploadAction(
  workspace: string,
  input: unknown,
) {
  const ctx = await serviceContext(workspace),
    store = importStore();
  if (!store?.signImportUpload)
    return { ok: false, error: "unavailable" } as const;
  const parsed = metadata.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid_input" } as const;
  try {
    return await prepareImportUpload(
      ctx,
      store.signImportUpload,
      parsed.data.bytes,
      parsed.data.kind,
    );
  } catch {
    return { ok: false, error: "failed" } as const;
  }
}

export async function completeImportUploadAction(
  workspace: string,
  id: string,
) {
  const ctx = await serviceContext(workspace);
  if (!importStore()) return { ok: false, error: "unavailable" } as const;
  try {
    return await completeImportUpload(ctx, id);
  } catch {
    return { ok: false, error: "failed" } as const;
  }
}

export async function changeImportAction(
  workspace: string,
  id: string,
  input: unknown,
) {
  const ctx = await serviceContext(workspace);
  if (!importStore()) return { ok: false, error: "unavailable" } as const;
  const parsed = z
    .discriminatedUnion("action", [
      z.object({ action: z.literal("validate"), mapping }).strict(),
      z.object({ action: z.literal("commit") }).strict(),
      z.object({ action: z.literal("cancel") }).strict(),
    ])
    .safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid_input" } as const;
  try {
    if (parsed.data.action === "validate")
      return await validateImport(ctx, id, parsed.data.mapping);
    if (parsed.data.action === "commit") return await commitImport(ctx, id);
    return (await cancelImport(ctx, id))
      ? ({ ok: true, value: { id } } as const)
      : ({ ok: false, error: "invalid_state" } as const);
  } catch {
    return { ok: false, error: "failed" } as const;
  }
}

export async function readImportAction(workspace: string, id: string) {
  const ctx = await serviceContext(workspace),
    store = importStore();
  if (!store) return { job: null, error: "unavailable" } as const;
  try {
    const job = await getImportJob(ctx, id);
    if (!job) return { job: null, error: "not_found" } as const;
    const view = await importErrorDelivery(ctx, id, store.sign);
    if (!view) return { job: null, error: "not_found" } as const;
    return {
      job: {
        ...view,
        canEdit:
          job.createdBy === ctx.actor.userId &&
          can(ctx.actor, "resource.create"),
        canCancel: can(ctx.actor, "resource.delete", {
          createdBy: job.createdBy,
        }),
      },
    };
  } catch {
    return { job: null, error: "storage_unavailable" } as const;
  }
}

export async function listImportsAction(
  workspace: string,
  input: unknown = {},
) {
  const ctx = await serviceContext(workspace),
    parsed = historyQuery.safeParse(input);
  if (!importStore()) return { data: null, error: "unavailable" } as const;
  if (!parsed.success) return { data: null, error: "invalid_input" } as const;
  try {
    return { data: await listImportJobs(ctx, parsed.data) };
  } catch {
    return { data: null, error: "failed" } as const;
  }
}

export async function listImportResultsAction(
  workspace: string,
  id: string,
  input: unknown = {},
) {
  const ctx = await serviceContext(workspace),
    parsed = rowQuery.safeParse(input);
  if (!importStore()) return { data: null, error: "unavailable" } as const;
  if (!parsed.success) return { data: null, error: "invalid_input" } as const;
  try {
    return { data: await listImportResults(ctx, id, parsed.data) };
  } catch {
    return { data: null, error: "failed" } as const;
  }
}

export async function searchImportTagsAction(
  workspace: string,
  id: string,
  search: unknown = "",
) {
  const ctx = await serviceContext(workspace);
  if (!importStore()) return { data: null, error: "unavailable" } as const;
  if (typeof search !== "string" || search.length > 64)
    return { data: null, error: "invalid_input" } as const;
  try {
    return { data: await searchImportTags(ctx, id, search) };
  } catch {
    return { data: null, error: "failed" } as const;
  }
}
