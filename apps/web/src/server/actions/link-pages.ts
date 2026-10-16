"use server";

import {
  createLink,
  deleteLinks,
  getLink,
  ruleDestinations,
  scanAndPersistLink,
  setLinkUtm,
  updateLink,
  type UtmVariant,
} from "@shortn/core";
import { ObjectId } from "mongodb";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { z } from "zod";
import { serviceContext } from "../context";
import { env } from "../env";
import { parseLinkAdvancedInput } from "../link-advanced-input";

// Form actions behind the full-page link flows (17): they read FormData,
// return field errors to the form, and navigate on success.

export interface FormState {
  error: string | null;
  created?: { id: string; url: string; path: string };
  field?: string | undefined;
  detail?: Record<string, string | number | null> | undefined;
}

const text = (form: FormData, name: string) => {
  const value = form.get(name);
  return typeof value === "string" ? value.trim() : "";
};

// Tags arrive as repeated fields; older forms may also post comma-separated newTags.
const tagsFrom = (form: FormData) =>
  [
    ...form
      .getAll("tag")
      .filter((value): value is string => typeof value === "string"),
    ...text(form, "newTags").split(","),
  ]
    .map((tag) => tag.trim())
    .filter(Boolean)
    .slice(0, 50);

const fieldOf: Record<string, string> = {
  invalid_url: "url",
  unsafe_destination: "url",
  invalid_key: "key",
  key_reserved: "key",
  key_taken: "key",
};

function scanLater(workspace: string, id: string) {
  after(async () => {
    try {
      const ctx = await serviceContext(workspace);
      await scanAndPersistLink(ctx, new ObjectId(id), {
        webRiskApiKey: env().WEB_RISK_API_KEY,
      });
    } catch (error) {
      console.error("link scan failed", id, error);
    }
  });
}

export async function createLinkPageAction(
  workspace: string,
  _state: FormState,
  form: FormData,
): Promise<FormState> {
  const url = text(form, "url");
  if (!url) return { error: "url_required", field: "url" };
  const advanced = parseLinkAdvancedInput(form);
  if (advanced.error) return { error: advanced.error, field: advanced.field };
  const ctx = await serviceContext(workspace);
  const result = await createLink(ctx, {
    url: url.slice(0, 2048),
    key: text(form, "key").slice(0, 64) || undefined,
    title: text(form, "title").slice(0, 200) || undefined,
    description: text(form, "description").slice(0, 500) || undefined,
    tags: tagsFrom(form),
    password: text(form, "password").slice(0, 128) || undefined,
    passwordHint: text(form, "passwordHint").slice(0, 100) || undefined,
    ...(advanced.value.rules ? { rules: advanced.value.rules } : {}),
    ...(advanced.value.og ? { og: advanced.value.og } : {}),
  });
  if (!result.ok)
    return {
      error: result.error,
      field: fieldOf[result.error],
      detail: result.detail,
    };
  scanLater(workspace, result.value.id);
  return {
    error: null,
    created: {
      id: result.value.id,
      url: `https://${result.value.domain}/${encodeURIComponent(result.value.key)}`,
      path: `/${workspace}/links/${result.value.id}`,
    },
  };
}

export async function updateLinkPageAction(
  workspace: string,
  id: string,
  _state: FormState,
  form: FormData,
): Promise<FormState> {
  const url = text(form, "url");
  if (!url) return { error: "url_required", field: "url" };
  const advanced = parseLinkAdvancedInput(form);
  if (advanced.error) return { error: advanced.error, field: advanced.field };
  const ctx = await serviceContext(workspace);
  const before = await getLink(ctx, id);
  if (!before) return { error: "not_found" };
  const passwordMode = text(form, "passwordMode");
  const result = await updateLink(ctx, id, {
    ...advanced.value,
    url: url.slice(0, 2048),
    key: text(form, "key").slice(0, 64) || undefined,
    title: text(form, "title").slice(0, 200),
    description: text(form, "description").slice(0, 500) || null,
    tags: tagsFrom(form),
    ...(passwordMode === "remove"
      ? { removePassword: true }
      : passwordMode === "set" && text(form, "password")
        ? {
            password: text(form, "password").slice(0, 128),
            passwordHint: text(form, "passwordHint").slice(0, 100) || null,
          }
        : before.password
          ? { passwordHint: text(form, "passwordHint").slice(0, 100) || null }
          : {}),
  });
  if (!result.ok)
    return {
      error: result.error,
      field: fieldOf[result.error],
      detail: result.detail,
    };
  if (
    result.value.url !== before.url ||
    (advanced.value.rules !== undefined &&
      JSON.stringify(ruleDestinations(advanced.value.rules)) !==
        JSON.stringify(ruleDestinations(before.rules)))
  )
    scanLater(workspace, id);
  redirect(`/${workspace}/links/${id}?saved=1`);
}

const ids = z
  .array(z.string().regex(/^[a-f0-9]{24}$/))
  .min(1)
  .max(500);

export async function deleteLinksPageAction(
  workspace: string,
  linkIds: string[],
): Promise<{ error: string | null }> {
  if (!ids.safeParse(linkIds).success) return { error: "invalid_input" };
  const result = await deleteLinks(await serviceContext(workspace), linkIds);
  if (!result.ok) return { error: result.error };
  redirect(`/${workspace}/links?deleted=${result.value.deleted.length}`);
}

const utmField = (form: FormData, name: string, max: number) =>
  text(form, name).slice(0, max) || undefined;

// Variants are stored as one list on the link; these rewrite it whole.
export async function saveUtmVariantAction(
  workspace: string,
  id: string,
  index: number | null,
  expected: UtmVariant[] | null,
  _state: FormState,
  form: FormData,
): Promise<FormState> {
  const variant = {
    source: utmField(form, "source", 100),
    medium: utmField(form, "medium", 100),
    campaign: utmField(form, "campaign", 80),
    term: utmField(form, "term", 100),
    content: utmField(form, "content", 100),
  };
  if (!Object.values(variant).some(Boolean))
    return { error: "utm_empty", field: "source" };
  const ctx = await serviceContext(workspace);
  const link = await getLink(ctx, id);
  if (!link) return { error: "not_found" };
  const current = link.utm.map((v) => ({
    source: v.source ?? undefined,
    medium: v.medium ?? undefined,
    campaign: v.campaign ?? undefined,
    term: v.term ?? undefined,
    content: v.content ?? undefined,
  }));
  if (index === null) {
    if (current.length >= 50) return { error: "utm_limit" };
    current.push(variant);
  } else if (index >= 0 && index < current.length) current[index] = variant;
  else return { error: "not_found" };
  const result = await setLinkUtm(
    ctx,
    id,
    current,
    expected ??
      link.utm.map((v) => ({
        source: v.source ?? undefined,
        medium: v.medium ?? undefined,
        campaign: v.campaign ?? undefined,
        term: v.term ?? undefined,
        content: v.content ?? undefined,
      })),
  );
  if (!result.ok) return { error: result.error, detail: result.detail };
  redirect(`/${workspace}/links/${id}/utm?saved=1`);
}

export async function removeUtmVariantAction(
  workspace: string,
  id: string,
  index: number,
  expected: UtmVariant[],
  _state: FormState,
): Promise<FormState> {
  void _state;
  if (!Number.isInteger(index) || index < 0 || !expected[index])
    return { error: "not_found" };
  const ctx = await serviceContext(workspace);
  const result = await setLinkUtm(
    ctx,
    id,
    expected.filter((_, i) => i !== index),
    expected,
  );
  if (!result.ok) return { error: result.error, detail: result.detail };
  redirect(`/${workspace}/links/${id}/utm?removed=1`);
}
