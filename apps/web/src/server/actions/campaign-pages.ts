"use server";

import {
  can,
  createCampaign,
  deleteCampaign,
  getCampaign,
  getLink,
  setLinkUtm,
  updateCampaign,
} from "@shortn/core";
import { redirect } from "next/navigation";
import {
  hasVariant,
  withVariant,
  type BuilderValues,
} from "@/components/campaigns/utm-url";
import { serviceContext } from "../context";
import { objectIds, text } from "../form-data";
import type { FormState } from "./link-pages";

// Form actions behind the full-page campaign flows (17): they read
// FormData, return field errors to the form, and navigate on success.

const fieldOf: Record<string, string> = {
  title_required: "title",
  invalid_title: "title",
  title_taken: "title",
  link_required: "link",
};

const failed = (
  error: string,
  detail?: Record<string, string | number | null>,
): FormState => ({ error, field: fieldOf[error], detail });

const list = (form: FormData, name: string) =>
  form
    .getAll(name)
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.trim().slice(0, 100))
    .filter(Boolean)
    .slice(0, 100);

export async function createCampaignPageAction(
  workspace: string,
  _state: FormState,
  form: FormData,
): Promise<FormState> {
  const title = text(form, "title").slice(0, 80);
  if (!title) return failed("title_required");
  const result = await createCampaign(await serviceContext(workspace), {
    title,
    description: text(form, "description").slice(0, 500) || undefined,
  });
  if (!result.ok) return failed(result.error, result.detail);
  redirect(`/${workspace}/campaigns/${result.value.id}?created=1`);
}

export async function updateCampaignPageAction(
  workspace: string,
  id: string,
  _state: FormState,
  form: FormData,
): Promise<FormState> {
  const title = text(form, "title").slice(0, 80);
  if (!title) return failed("title_required");
  const result = await updateCampaign(await serviceContext(workspace), id, {
    title,
    description: text(form, "description").slice(0, 500) || null,
    utmDefaults: {
      sources: list(form, "sources"),
      mediums: list(form, "mediums"),
      terms: list(form, "terms"),
      contents: list(form, "contents"),
    },
  });
  if (!result.ok) return failed(result.error, result.detail);
  redirect(`/${workspace}/campaigns/${id}?saved=1`);
}

export async function deleteCampaignPageAction(
  workspace: string,
  id: string,
): Promise<{ error: string | null }> {
  const result = await deleteCampaign(await serviceContext(workspace), id);
  if (!result.ok) return { error: result.error };
  redirect(`/${workspace}/campaigns?deleted=1`);
}

const maxVariants = 50;

// The builder's "Save as variant": adds the tagged variant to the link,
// which also makes the link a member of the campaign.
export async function saveVariantPageAction(
  workspace: string,
  id: string,
  _state: FormState,
  form: FormData,
): Promise<FormState> {
  const requested = form.getAll("link");
  if (!requested.length) return failed("link_required");
  if (requested.length > 500) return failed("invalid_input");
  const linkIds = objectIds(requested);
  if (linkIds.length !== requested.length) return failed("invalid_input");
  const uniqueIds = [...new Set(linkIds)];
  const values: BuilderValues = {
    source: text(form, "source").slice(0, 100),
    medium: text(form, "medium").slice(0, 100),
    term: text(form, "term").slice(0, 100),
    content: text(form, "content").slice(0, 100),
  };
  const ctx = await serviceContext(workspace);
  if (!can(ctx.actor, "resource.update")) return failed("forbidden");
  const campaign = await getCampaign(ctx, id);
  if (!campaign) return failed("not_found");
  const links = [];
  // Validate every owned target before making the first change.
  for (let at = 0; at < uniqueIds.length; at += 20) {
    const batch = await Promise.all(
      uniqueIds.slice(at, at + 20).map((linkId) => getLink(ctx, linkId)),
    );
    if (batch.some((link) => !link)) return failed("not_found");
    for (const link of batch) if (link) links.push(link);
  }
  const additions = links.filter(
    (link) => !hasVariant(link, campaign.title, values),
  );
  if (uniqueIds.length === 1 && !additions.length) return failed("duplicate");
  if (additions.some((link) => link.utm.length >= maxVariants))
    return failed("full", { max: maxVariants });
  let saved = 0;
  for (const link of additions) {
    try {
      const variants = withVariant(link, campaign.title, values);
      const result = await setLinkUtm(
        ctx,
        link.id,
        variants,
        variants.slice(0, -1),
      );
      if (!result.ok)
        return saved
          ? failed("partial", { count: saved })
          : failed(result.error, result.detail);
      saved++;
    } catch {
      return saved ? failed("partial", { count: saved }) : failed("generic");
    }
  }
  if (uniqueIds.length === 1)
    redirect(`/${workspace}/campaigns/${id}?variant=${uniqueIds[0]}`);
  redirect(
    `/${workspace}/campaigns/${id}?variants=${saved}&skipped=${links.length - additions.length}`,
  );
}
