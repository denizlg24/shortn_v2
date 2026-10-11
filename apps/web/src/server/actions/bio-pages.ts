"use server";

import {
  bioSlugStatus,
  createBioPage,
  deleteBioPage,
  getBioPage,
  setBioLinks,
  updateBioPage,
} from "@shortn/core";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  appearanceOf,
  appearanceProblem,
  badLinkImage,
  badSocial,
  linksInput,
  profileOf,
  profilePatch,
  profileProblem,
  socialsInput,
  themeOf,
  type AppearanceDraft,
} from "@/components/bio/bio-draft";
import {
  avatarShapes,
  buttonStyles,
  headerStyles,
} from "@/components/bio/bio-rules";
import { serviceContext } from "../context";
import { jsonFrom, objectIds, text } from "../form-data";
import { revalidateLegacyBio } from "../legacy";
import type { FormState } from "./link-pages";

// Form actions behind the bio page tabs (17): each tab posts its own
// section, the checks run here, and a save goes back to the overview.

const fieldOf: Record<string, string> = {
  slug_required: "slug",
  invalid_slug: "slug",
  slug_taken: "slug",
  titleRequired: "title",
  avatarUrl: "avatarUrl",
  color: "color",
  background: "background",
  headerImage: "headerImage",
};

const failed = (
  error: string,
  detail?: Record<string, string | number | null>,
): FormState => ({ error, field: fieldOf[error], detail });

export async function checkBioSlugAction(
  workspace: string,
  slug: string,
): Promise<"available" | "invalid" | "taken"> {
  if (typeof slug !== "string" || slug.length > 63) return "invalid";
  return bioSlugStatus(await serviceContext(workspace), slug);
}

export async function createBioPageAction(
  workspace: string,
  _state: FormState,
  form: FormData,
): Promise<FormState> {
  const slug = text(form, "slug").toLowerCase().slice(0, 63);
  if (!slug) return failed("slug_required");
  const result = await createBioPage(await serviceContext(workspace), {
    slug,
    title: text(form, "title").slice(0, 120) || undefined,
    linkId: objectIds([text(form, "link")])[0],
  });
  if (!result.ok) return failed(result.error, result.detail);
  redirect(`/${workspace}/bio/${result.value.id}?created=1`);
}

async function saved(
  workspace: string,
  id: string,
  slug: string,
  tab: string,
): Promise<never> {
  await revalidateLegacyBio([slug]);
  redirect(`/${workspace}/bio/${id}?saved=${tab}`);
}

export async function saveBioProfileAction(
  workspace: string,
  id: string,
  _state: FormState,
  form: FormData,
): Promise<FormState> {
  const ctx = await serviceContext(workspace);
  const bio = await getBioPage(ctx, id);
  if (!bio) return failed("not_found");
  const shape = avatarShapes.find((item) => item === text(form, "avatarShape"));
  const draft = {
    title: text(form, "title").slice(0, 120),
    description: text(form, "description").slice(0, 500),
    avatarUrl: text(form, "avatarUrl").slice(0, 2048),
    avatarShape: shape ?? bio.avatarShape,
  };
  const problem = profileProblem(draft);
  if (problem) return failed(problem);
  const result = await updateBioPage(
    ctx,
    id,
    profilePatch(profileOf(bio), draft),
  );
  if (!result.ok) return failed(result.error, result.detail);
  return saved(workspace, id, result.value.slug, "profile");
}

const linkItems = z
  .array(
    z.object({
      linkId: z.string().max(24),
      key: z.string().max(64),
      url: z.string().max(2048),
      title: z.string().max(120),
      image: z.string().max(2048),
    }),
  )
  .max(100);

export async function saveBioLinksAction(
  workspace: string,
  id: string,
  _state: FormState,
  form: FormData,
): Promise<FormState> {
  const parsed = linkItems.safeParse(jsonFrom(form, "links"));
  if (!parsed.success) return failed("invalid_input");
  const bad = badLinkImage(parsed.data);
  if (bad >= 0)
    return {
      error: "image",
      field: `link-${bad}`,
      detail: { position: bad + 1 },
    };
  const result = await setBioLinks(
    await serviceContext(workspace),
    id,
    linksInput(parsed.data),
  );
  if (!result.ok) return failed(result.error, result.detail);
  return saved(workspace, id, result.value.slug, "links");
}

const socialItems = z
  .array(
    z.object({
      id: z.string().max(64),
      platform: z.string().trim().min(1).max(32),
      url: z.string().max(2048),
    }),
  )
  .max(20);

export async function saveBioSocialsAction(
  workspace: string,
  id: string,
  _state: FormState,
  form: FormData,
): Promise<FormState> {
  const parsed = socialItems.safeParse(jsonFrom(form, "socials"));
  if (!parsed.success) return failed("invalid_input");
  const bad = badSocial(parsed.data);
  if (bad >= 0)
    return {
      error: "url",
      field: `social-${bad}`,
      detail: { position: bad + 1 },
    };
  const result = await updateBioPage(await serviceContext(workspace), id, {
    socials: socialsInput(parsed.data),
  });
  if (!result.ok) return failed(result.error, result.detail);
  return saved(workspace, id, result.value.slug, "socials");
}

const appearanceInput = z.object({
  background: z.string().max(600),
  textColor: z.string().max(64),
  primaryColor: z.string().max(64),
  buttonTextColor: z.string().max(64),
  buttonStyle: z.enum(buttonStyles).optional(),
  font: z.string().max(64),
  header: z.literal("none").or(z.enum(headerStyles)),
  headerBackgroundColor: z.string().max(64),
  headerBackgroundImage: z.string().max(2048),
  socialColor: z.string().max(64),
});

export async function saveBioAppearanceAction(
  workspace: string,
  id: string,
  _state: FormState,
  form: FormData,
): Promise<FormState> {
  const parsed = appearanceInput.safeParse(jsonFrom(form, "appearance"));
  if (!parsed.success) return failed("invalid_input");
  const ctx = await serviceContext(workspace);
  const bio = await getBioPage(ctx, id);
  if (!bio) return failed("not_found");
  // Theme fields the editor doesn't show (legacy font sizes) come from
  // what is stored, never from the client.
  const draft: AppearanceDraft = {
    ...parsed.data,
    buttonStyle: parsed.data.buttonStyle,
    rest: appearanceOf(bio).rest,
  };
  const problem = appearanceProblem(draft);
  if (problem) return failed(problem);
  const result = await updateBioPage(ctx, id, {
    theme: themeOf(draft),
    socialColor: draft.socialColor.trim() || "original",
  });
  if (!result.ok) return failed(result.error, result.detail);
  return saved(workspace, id, result.value.slug, "appearance");
}

export async function deleteBioPageAction(
  workspace: string,
  id: string,
): Promise<{ error: string | null }> {
  const result = await deleteBioPage(await serviceContext(workspace), id);
  if (!result.ok) return { error: result.error };
  await revalidateLegacyBio([result.value.slug]);
  redirect(`/${workspace}/bio?deleted=1`);
}
