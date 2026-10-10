"use server";

import {
  createLink,
  dailyTrends,
  deleteLinks,
  getLink,
  listLinks,
  listTags,
  scanAndPersistLink,
  setLinkUtm,
  updateLink,
  type LinkView,
} from "@shortn/core";
import { ObjectId, type Db } from "mongodb";
import { after } from "next/server";
import { z } from "zod";
import { serviceContext } from "../context";
import { env } from "../env";
import { invalidInput, toAction, type ActionResult } from "./result";

export interface LinkListItem extends LinkView {
  trend: number[];
}

const slug = z.string().min(1).max(64);
const optionalText = (max: number) => z.string().max(max).optional();

const createInput = z.object({
  url: z.string().min(1).max(2048),
  key: optionalText(64),
  title: optionalText(200),
  description: optionalText(500),
  tags: z.array(z.string().max(48)).max(50).optional(),
  password: optionalText(128),
  passwordHint: optionalText(100),
});

const updateInput = z.object({
  url: optionalText(2048),
  key: optionalText(64),
  title: optionalText(200),
  description: z.string().max(500).nullable().optional(),
  tags: z.array(z.string().max(48)).max(50).optional(),
  password: optionalText(128),
  passwordHint: z.string().max(100).nullable().optional(),
  removePassword: z.boolean().optional(),
});

const listInput = z.object({
  search: optionalText(200),
  tags: z.array(z.string().max(48)).max(20).optional(),
  cursor: optionalText(64),
  limit: z.number().int().min(1).max(200).optional(),
});

const utmInput = z
  .array(
    z.object({
      source: optionalText(100),
      medium: optionalText(100),
      campaign: optionalText(80),
      term: optionalText(100),
      content: optionalText(100),
    }),
  )
  .max(50);

async function withTrends(db: Db, links: LinkView[]): Promise<LinkListItem[]> {
  if (!links.length) return [];
  const trends = await dailyTrends(
    db,
    links.map((link) => new ObjectId(link.id)),
  );
  return links.map((link) => ({ ...link, trend: trends.get(link.id) ?? [] }));
}

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

export async function listLinksAction(
  workspace: string,
  input: z.input<typeof listInput> = {},
): Promise<ActionResult<{ links: LinkListItem[]; nextCursor: string | null }>> {
  const parsed = listInput.safeParse(input);
  if (!slug.safeParse(workspace).success || !parsed.success)
    return invalidInput;
  const ctx = await serviceContext(workspace);
  const page = await listLinks(ctx, parsed.data);
  return {
    ok: true,
    data: {
      links: await withTrends(ctx.db, page.links),
      nextCursor: page.nextCursor,
    },
  };
}

export async function getLinkAction(
  workspace: string,
  id: string,
): Promise<ActionResult<LinkView>> {
  const ctx = await serviceContext(workspace);
  const link = await getLink(ctx, id);
  return link ? { ok: true, data: link } : { ok: false, error: "not_found" };
}

export async function createLinkAction(
  workspace: string,
  input: z.input<typeof createInput>,
): Promise<ActionResult<LinkListItem>> {
  const parsed = createInput.safeParse(input);
  if (!parsed.success) return invalidInput;
  const ctx = await serviceContext(workspace);
  const result = await createLink(ctx, parsed.data);
  if (!result.ok) return toAction(result);
  scanLater(workspace, result.value.id);
  return {
    ok: true,
    data: { ...result.value, trend: Array<number>(30).fill(0) },
  };
}

export async function updateLinkAction(
  workspace: string,
  id: string,
  input: z.input<typeof updateInput>,
): Promise<ActionResult<LinkView>> {
  const parsed = updateInput.safeParse(input);
  if (!parsed.success) return invalidInput;
  const ctx = await serviceContext(workspace);
  const result = await updateLink(ctx, id, parsed.data);
  if (result.ok && parsed.data.url !== undefined) scanLater(workspace, id);
  return toAction(result);
}

export async function deleteLinksAction(
  workspace: string,
  ids: string[],
): Promise<ActionResult<{ deleted: string[] }>> {
  if (!z.array(z.string().max(24)).max(500).safeParse(ids).success)
    return invalidInput;
  const ctx = await serviceContext(workspace);
  return toAction(await deleteLinks(ctx, ids));
}

export async function setLinkUtmAction(
  workspace: string,
  id: string,
  variants: z.input<typeof utmInput>,
): Promise<ActionResult<null>> {
  const parsed = utmInput.safeParse(variants);
  if (!parsed.success) return invalidInput;
  const ctx = await serviceContext(workspace);
  return toAction(await setLinkUtm(ctx, id, parsed.data));
}

export async function listTagsAction(workspace: string) {
  const ctx = await serviceContext(workspace);
  return listTags(ctx);
}
