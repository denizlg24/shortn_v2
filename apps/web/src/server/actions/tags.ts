"use server";

import {
  deleteTag,
  mergeTag,
  pageTags,
  setTagColor,
  updateTag,
  type TagColor,
} from "@shortn/core";
import { isTagColor } from "@shortn/core/tag-options";
import { redirect } from "next/navigation";
import { z } from "zod";
import { serviceContext } from "../context";
import { text } from "../form-data";
import type { FormState } from "./link-pages";
import type { ActionResult } from "./result";

// Form actions behind the full-page tag flows: they read FormData, return
// field errors to the form, and navigate to the library on success.

const slug = z.string().min(1).max(64);
const objectId = z.string().regex(/^[a-f\d]{24}$/i);

export async function setTagColorAction(
  workspace: string,
  id: string,
  color: TagColor,
): Promise<ActionResult<{ color: TagColor }>> {
  if (
    !slug.safeParse(workspace).success ||
    !objectId.safeParse(id).success ||
    !isTagColor(color)
  )
    return { ok: false, error: "invalid_input" };
  const result = await setTagColor(await serviceContext(workspace), id, color);
  return result.ok
    ? { ok: true, data: { color: result.value.color } }
    : { ok: false, error: result.error };
}

export async function updateTagPageAction(
  workspace: string,
  id: string,
  _state: FormState,
  form: FormData,
): Promise<FormState> {
  const name = text(form, "name");
  const color = text(form, "color");
  if (!name) return { error: "invalid_input", field: "name" };
  const ctx = await serviceContext(workspace);
  const renamed = await updateTag(ctx, id, name);
  if (!renamed.ok)
    return {
      error: renamed.error,
      field: ["name_taken", "invalid_input"].includes(renamed.error)
        ? "name"
        : undefined,
    };
  if (isTagColor(color)) {
    const colored = await setTagColor(ctx, id, color);
    if (!colored.ok) return { error: colored.error };
  }
  redirect(`/${workspace}/tags?saved=1`);
}

export async function mergeTagPageAction(
  workspace: string,
  id: string,
  _state: FormState,
  form: FormData,
): Promise<FormState> {
  const target = text(form, "target");
  if (!objectId.safeParse(target).success)
    return { error: "invalid_input", field: "target" };
  const result = await mergeTag(await serviceContext(workspace), id, target);
  if (!result.ok) return { error: result.error };
  redirect(`/${workspace}/tags?merged=1`);
}

export async function deleteTagPageAction(
  workspace: string,
  id: string,
): Promise<{ error: string | null }> {
  const result = await deleteTag(await serviceContext(workspace), id);
  if (!result.ok) return { error: result.error };
  redirect(`/${workspace}/tags?deleted=1`);
}

/** Merge targets: a bounded server search that never lists the whole library. */
export async function tagTargetsAction(
  workspace: string,
  input: { search: string; exclude: string },
) {
  const parsed = z
    .object({ search: z.string().max(200), exclude: objectId })
    .safeParse(input);
  if (!slug.safeParse(workspace).success || !parsed.success) return [];
  const result = await pageTags(await serviceContext(workspace), {
    search: parsed.data.search,
    limit: 40,
    counts: false,
  });
  return result.items
    .filter((tag) => tag.id !== parsed.data.exclude)
    .map(({ id, name, color }) => ({ id, name, color }));
}
