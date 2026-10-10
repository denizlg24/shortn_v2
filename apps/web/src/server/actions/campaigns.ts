"use server";

import {
  campaignLinks,
  createCampaign,
  deleteCampaign,
  getCampaign,
  listCampaigns,
  toLinkView,
  updateCampaign,
  type CampaignView,
  type LinkView,
} from "@shortn/core";
import { z } from "zod";
import { serviceContext } from "../context";
import { invalidInput, toAction, type ActionResult } from "./result";

const list = z.array(z.string().max(100)).max(100);
const updateInput = z.object({
  title: z.string().max(80).optional(),
  description: z.string().max(500).nullable().optional(),
  utmDefaults: z
    .object({ sources: list, mediums: list, terms: list, contents: list })
    .optional(),
});

export async function listCampaignsAction(
  workspace: string,
): Promise<CampaignView[]> {
  return listCampaigns(await serviceContext(workspace));
}

export async function getCampaignAction(
  workspace: string,
  id: string,
): Promise<ActionResult<{ campaign: CampaignView; links: LinkView[] }>> {
  const ctx = await serviceContext(workspace);
  const [campaign, members] = await Promise.all([
    getCampaign(ctx, id),
    campaignLinks(ctx, id),
  ]);
  if (!campaign || !members) return { ok: false, error: "not_found" };
  return {
    ok: true,
    data: {
      campaign,
      links: members.links.map((link) => toLinkView(link, ctx.linkDomain)),
    },
  };
}

export async function createCampaignAction(
  workspace: string,
  input: { title: string; description?: string },
): Promise<ActionResult<CampaignView>> {
  const parsed = z
    .object({
      title: z.string().min(1).max(80),
      description: z.string().max(500).optional(),
    })
    .safeParse(input);
  if (!parsed.success) return invalidInput;
  return toAction(
    await createCampaign(await serviceContext(workspace), parsed.data),
  );
}

export async function updateCampaignAction(
  workspace: string,
  id: string,
  input: z.input<typeof updateInput>,
): Promise<ActionResult<CampaignView>> {
  const parsed = updateInput.safeParse(input);
  if (!parsed.success) return invalidInput;
  return toAction(
    await updateCampaign(await serviceContext(workspace), id, parsed.data),
  );
}

export async function deleteCampaignAction(
  workspace: string,
  id: string,
): Promise<ActionResult<null>> {
  return toAction(await deleteCampaign(await serviceContext(workspace), id));
}
