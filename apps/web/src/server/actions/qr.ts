"use server";

import {
  createQr,
  deleteQrs,
  getQr,
  listQrs,
  qrDesignSchema,
  updateQr,
  type QrView,
} from "@shortn/core";
import { z } from "zod";
import { serviceContext } from "../context";
import { invalidInput, toAction, type ActionResult } from "./result";

const design = qrDesignSchema.optional();

const createInput = z.object({
  url: z.string().min(1).max(2048),
  title: z.string().max(200).optional(),
  tags: z.array(z.string().max(48)).max(50).optional(),
  design,
  attachToLinkId: z.string().max(24).optional(),
});
const updateInput = z.object({
  url: z.string().max(2048).optional(),
  title: z.string().max(200).optional(),
  tags: z.array(z.string().max(48)).max(50).optional(),
  design,
  applyToLink: z.boolean().optional(),
});

export async function listQrsAction(
  workspace: string,
  search?: string,
): Promise<QrView[]> {
  return listQrs(await serviceContext(workspace), {
    search: search?.slice(0, 200),
  });
}

export async function getQrAction(
  workspace: string,
  id: string,
): Promise<ActionResult<QrView>> {
  const qr = await getQr(await serviceContext(workspace), id);
  return qr ? { ok: true, data: qr } : { ok: false, error: "not_found" };
}

export async function createQrAction(
  workspace: string,
  input: z.input<typeof createInput>,
): Promise<ActionResult<QrView>> {
  const parsed = createInput.safeParse(input);
  if (!parsed.success) return invalidInput;
  return toAction(await createQr(await serviceContext(workspace), parsed.data));
}

export async function updateQrAction(
  workspace: string,
  id: string,
  input: z.input<typeof updateInput>,
): Promise<ActionResult<QrView>> {
  const parsed = updateInput.safeParse(input);
  if (!parsed.success) return invalidInput;
  return toAction(
    await updateQr(await serviceContext(workspace), id, parsed.data),
  );
}

export async function deleteQrsAction(
  workspace: string,
  ids: string[],
): Promise<ActionResult<{ deleted: string[] }>> {
  if (!z.array(z.string().max(24)).max(500).safeParse(ids).success)
    return invalidInput;
  return toAction(await deleteQrs(await serviceContext(workspace), ids));
}
