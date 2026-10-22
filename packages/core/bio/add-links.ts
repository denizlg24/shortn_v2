import { collection } from "@shortn/db";
import { ObjectId } from "mongodb";
import { z } from "zod";
import { can } from "../workspaces/authz";
import { ownedBy } from "../workspaces/service";
import type { ServiceContext } from "../workspaces/context";
import { fail, ok } from "../result";
import { groupBioLinks, newBioLinksSection } from "./content";
import { readBioDraft, saveBioDraft } from "./publishing";

export const addBioLinksInput = z.object({
  revision: z.number().int().min(0),
  ids: z
    .array(z.string().regex(/^[a-f\d]{24}$/i))
    .min(1)
    .max(500),
  sectionId: z.string().min(1).max(100).optional(),
  sectionTitle: z.string().trim().max(120).default(""),
});

/** Append to the chosen draft section without publishing unrelated edits. */
export async function addLinksToBioDraft(
  ctx: ServiceContext,
  id: string,
  input: unknown,
) {
  if (!can(ctx.actor, "resource.update")) return fail("forbidden" as const);
  const parsed = addBioLinksInput.safeParse(input);
  if (!parsed.success) return fail("invalid_input" as const);
  const draft = await readBioDraft(ctx, id);
  if (!draft) return fail("not_found" as const);
  if (draft.revision !== parsed.data.revision) return fail("conflict" as const);
  const content = groupBioLinks(draft.content);
  const section = parsed.data.sectionId
    ? content.blocks.find(
        (b) => b.id === parsed.data.sectionId && b.type === "links",
      )
    : {
        ...newBioLinksSection(crypto.randomUUID()),
        title: parsed.data.sectionTitle,
      };
  if (!section || section.type !== "links")
    return fail("section_not_found" as const);
  const ids = [...new Set(parsed.data.ids.map((value) => value.toLowerCase()))];
  const links = await collection(ctx.db, "links")
    .find(
      {
        $and: [
          ownedBy(ctx.workspace, "sub"),
          {
            _id: { $in: ids.map((value) => new ObjectId(value)) },
            deletedAt: { $exists: false },
          },
        ],
      },
      { projection: { title: 1, key: 1, urlCode: 1 } },
    )
    .toArray();
  if (links.length !== ids.length) return fail("link_not_found" as const);
  const existing = new Set(
    section.items.map((item) => item.linkId.toLowerCase()),
  );
  const additions = ids.filter((value) => !existing.has(value));
  if (
    section.items.length + additions.length > 1000 ||
    (!parsed.data.sectionId && content.blocks.length >= 150)
  )
    return fail("limit_reached" as const);
  if (!additions.length)
    return ok({ added: 0, skipped: ids.length, sectionId: section.id });
  const byId = new Map(links.map((link) => [link._id.toHexString(), link]));
  const updated = {
    ...section,
    items: [
      ...section.items,
      ...additions.map((linkId) => ({
        id: crypto.randomUUID(),
        linkId,
        title: String(
          byId.get(linkId)?.title ||
            byId.get(linkId)?.key ||
            byId.get(linkId)?.urlCode ||
            "",
        ).slice(0, 120),
        visible: true,
        image: "",
        highlight: false,
      })),
    ],
  };
  const result = await saveBioDraft(ctx, id, draft.revision, {
    ...content,
    blocks: parsed.data.sectionId
      ? content.blocks.map((block) =>
          block.id === section.id ? updated : block,
        )
      : [...content.blocks, updated],
  });
  return result.ok
    ? ok({
        added: additions.length,
        skipped: ids.length - additions.length,
        sectionId: section.id,
      })
    : result;
}
