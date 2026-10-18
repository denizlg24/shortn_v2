"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import {
  requestQrExport,
  requestQrZip,
  qrExportDelivery,
  qrZipDelivery,
  getQrExport,
  can,
} from "@shortn/core";
import { decodeSelection } from "@/lib/bulk-selection";
import type { ExportRead, ExportStatus } from "@/lib/qr-export";
import { serviceContext } from "../context";
import { qrExportStore } from "../qr-exports";

export async function prepareQrExportAction(
  workspace: string,
  bundle: boolean,
  _state: { error?: string },
  form: FormData,
): Promise<{ error?: string }> {
  const ctx = await serviceContext(workspace),
    store = qrExportStore();
  if (!store) return { error: "unavailable" };
  const ids = decodeSelection(form.get("selection"));
  const parsed = z
    .object({
      format: z.enum(["svg", "png", "pdf"]),
      size: z.coerce.number().int().min(128).max(4096),
    })
    .safeParse({ format: form.get("format"), size: form.get("size") });
  if (!ids.length || (!bundle && ids.length !== 1) || !parsed.success)
    return { error: "invalid_export" };
  let jobId: string;
  try {
    const result = bundle
      ? await requestQrZip(ctx, { ids, ...parsed.data })
      : await requestQrExport(ctx, ids[0]!, parsed.data);
    if (!result.ok) return { error: result.error };
    jobId = result.value.id;
  } catch {
    return { error: "failed" };
  }
  redirect(
    `/${workspace}/qr/exports/${jobId}?kind=${bundle ? "zip" : "single"}`,
  );
}

export async function readQrExportAction(
  workspace: string,
  id: string,
  kind: "single" | "zip",
): Promise<ExportRead> {
  const ctx = await serviceContext(workspace),
    store = qrExportStore();
  if (!store) return { job: null, error: "unavailable" };
  if (!["single", "zip"].includes(kind) || !/^[a-f0-9]{24}$/i.test(id))
    return { job: null, error: "unavailable" };
  try {
    const value =
      kind === "zip"
        ? await qrZipDelivery(ctx, id, store.sign)
        : await qrExportDelivery(ctx, id, store.sign);
    if (!value) return { job: null, error: "unavailable" };
    const job: ExportStatus = {
      id: value.id,
      state: value.state,
      format: "itemFormat" in value ? value.itemFormat : value.format,
      size: value.size,
      total: "total" in value ? value.total : 1,
      done: "done" in value ? value.done : value.state === "completed" ? 1 : 0,
      canEdit: can(ctx.actor, "resource.update"),
      expiresAt: value.expiresAt,
      ...("phase" in value ? { phase: value.phase } : {}),
      ...(value.error ? { error: value.error } : {}),
      ...("print" in value && value.print ? { print: value.print } : {}),
      ...("failedQrId" in value && value.failedQrId
        ? { failedQrId: value.failedQrId }
        : {}),
      ...("downloadUrl" in value && typeof value.downloadUrl === "string"
        ? { downloadUrl: value.downloadUrl }
        : {}),
      ...("downloadExpiresAt" in value &&
      typeof value.downloadExpiresAt === "string"
        ? { downloadExpiresAt: value.downloadExpiresAt }
        : {}),
    };
    if (kind === "single" && job.state === "failed") {
      const row = await getQrExport(ctx, id);
      if (row) job.failedQrId = row.qrId.toHexString();
    }
    return { job };
  } catch {
    return { job: null, error: "storage_unavailable" };
  }
}
