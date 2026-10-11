"use server";

import {
  createQr,
  deleteQrs,
  getQr,
  qrDesignSchema,
  updateQr,
  type QrDesign,
} from "@shortn/core";
import { redirect } from "next/navigation";
import { serviceContext } from "../context";
import { jsonFrom, objectIds, tagsFrom, text } from "../form-data";
import type { FormState } from "./link-pages";

// Form actions behind the full-page QR flows (17): they read FormData,
// return field errors to the form, and navigate on success.

const fieldOf: Record<string, string> = {
  url_required: "url",
  invalid_url: "url",
  unsafe_destination: "url",
  feature_required: "logo",
  logo_url: "logo",
  color: "design",
};

const failed = (
  error: string,
  detail?: Record<string, string | number | null>,
): FormState => ({ error, field: fieldOf[error], detail });

const httpUrl = /^https?:\/\/\S+$/i;

const colorsOf = (design: QrDesign) => [
  design.dotsOptions?.color,
  design.backgroundOptions?.color,
  design.cornersSquareOptions?.color,
  design.cornersDotOptions?.color,
];

// The design editor posts its option groups as JSON: the whole design on
// create, only the changed groups on edit.
function designFrom(
  form: FormData,
): { ok: true; design: QrDesign } | { ok: false; error: string } {
  const parsed = qrDesignSchema.safeParse(jsonFrom(form, "design") ?? {});
  if (!parsed.success) return { ok: false, error: "invalid_input" };
  const design = parsed.data;
  if (design.image && !httpUrl.test(design.image))
    return { ok: false, error: "logo_url" };
  if (colorsOf(design).some((color) => color !== undefined && !color.trim()))
    return { ok: false, error: "color" };
  return { ok: true, design };
}

const linkId = (form: FormData) => objectIds([text(form, "link")])[0];

export async function createQrPageAction(
  workspace: string,
  _state: FormState,
  form: FormData,
): Promise<FormState> {
  const url = text(form, "url");
  if (!url) return failed("url_required");
  const design = designFrom(form);
  if (!design.ok) return failed(design.error);
  const ctx = await serviceContext(workspace);
  const result = await createQr(ctx, {
    url: url.slice(0, 2048),
    title: text(form, "title").slice(0, 200) || undefined,
    tags: tagsFrom(form),
    design: design.design,
    attachToLinkId: linkId(form),
  });
  if (!result.ok) return failed(result.error, result.detail);
  redirect(`/${workspace}/qr/${result.value.id}?created=1`);
}

const sameTags = (a: string[], b: string[]) =>
  a.length === b.length && a.every((tag) => b.includes(tag));

export async function updateQrDetailsPageAction(
  workspace: string,
  id: string,
  _state: FormState,
  form: FormData,
): Promise<FormState> {
  const url = text(form, "url");
  if (!url) return failed("url_required");
  const ctx = await serviceContext(workspace);
  const qr = await getQr(ctx, id);
  if (!qr) return failed("not_found");
  const title = text(form, "title").slice(0, 200);
  const tags = tagsFrom(form);
  const current = qr.tags.map((tag) => tag.name);
  const changes = {
    ...(url !== qr.url ? { url: url.slice(0, 2048) } : {}),
    ...(title !== qr.title ? { title } : {}),
    ...(sameTags(tags, current) ? {} : { tags }),
  };
  if (Object.keys(changes).length) {
    const result = await updateQr(ctx, id, {
      ...changes,
      applyToLink: form.get("applyToLink") === "on",
    });
    if (!result.ok) return failed(result.error, result.detail);
  }
  redirect(`/${workspace}/qr/${id}?saved=1`);
}

export async function saveQrDesignPageAction(
  workspace: string,
  id: string,
  _state: FormState,
  form: FormData,
): Promise<FormState> {
  const design = designFrom(form);
  if (!design.ok) return failed(design.error);
  if (Object.keys(design.design).length) {
    const result = await updateQr(await serviceContext(workspace), id, {
      design: design.design,
    });
    if (!result.ok) return failed(result.error, result.detail);
  }
  redirect(`/${workspace}/qr/${id}?saved=1`);
}

export async function deleteQrsPageAction(
  workspace: string,
  ids: string[],
): Promise<{ error: string | null }> {
  const valid = objectIds(ids);
  if (!valid.length || valid.length !== ids.length)
    return { error: "invalid_input" };
  const result = await deleteQrs(await serviceContext(workspace), valid);
  if (!result.ok) return { error: result.error };
  redirect(`/${workspace}/qr?deleted=${result.value.deleted.length}`);
}
