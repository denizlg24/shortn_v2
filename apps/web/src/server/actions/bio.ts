"use server";

import {
  createBioPage,
  deleteBioPage,
  getBioPage,
  listBioPages,
  setBioLinks,
  updateBioPage,
  type BioEditable,
  type BioSummary,
} from "@shortn/core";
import { z } from "zod";
import { serviceContext } from "../context";
import { revalidateLegacyBio } from "../legacy";
import { invalidInput, toAction, type ActionResult } from "./result";

export async function listBioPagesAction(
  workspace: string,
): Promise<BioSummary[]> {
  return listBioPages(await serviceContext(workspace));
}

export async function getBioPageAction(
  workspace: string,
  id: string,
): Promise<ActionResult<BioEditable>> {
  const page = await getBioPage(await serviceContext(workspace), id);
  return page ? { ok: true, data: page } : { ok: false, error: "not_found" };
}

export async function createBioPageAction(
  workspace: string,
  input: { slug: string; title?: string; linkId?: string },
): Promise<ActionResult<BioSummary>> {
  const parsed = z
    .object({
      slug: z.string().min(1).max(63),
      title: z.string().max(120).optional(),
      linkId: z.string().max(24).optional(),
    })
    .safeParse(input);
  if (!parsed.success) return invalidInput;
  return toAction(
    await createBioPage(await serviceContext(workspace), parsed.data),
  );
}

// The service validates the patch and link list shapes itself.
export async function updateBioPageAction(
  workspace: string,
  id: string,
  patch: unknown,
): Promise<ActionResult<BioSummary>> {
  const result = await updateBioPage(
    await serviceContext(workspace),
    id,
    patch,
  );
  if (result.ok) await revalidateLegacyBio([result.value.slug]);
  return toAction(result);
}

export async function setBioLinksAction(
  workspace: string,
  id: string,
  links: unknown,
): Promise<ActionResult<BioSummary>> {
  const result = await setBioLinks(await serviceContext(workspace), id, links);
  if (result.ok) await revalidateLegacyBio([result.value.slug]);
  return toAction(result);
}

export async function deleteBioPageAction(
  workspace: string,
  id: string,
): Promise<ActionResult<{ slug: string }>> {
  const result = await deleteBioPage(await serviceContext(workspace), id);
  if (result.ok) await revalidateLegacyBio([result.value.slug]);
  return toAction(result);
}
