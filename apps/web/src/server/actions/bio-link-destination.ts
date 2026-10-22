"use server";

import {
  addLinksToBioDraft,
  can,
  cursorBioPages,
  readBioDraft,
} from "@shortn/core";
import { groupBioLinks } from "@shortn/core/bio-content";
import { revalidatePath } from "next/cache";
import { serviceContext } from "../context";

export async function bioDestinationsAction(
  workspace: string,
  search: string,
  cursor?: string,
) {
  const ctx = await serviceContext(workspace);
  if (!can(ctx.actor, "resource.update")) throw new Error("forbidden");
  const result = await cursorBioPages(ctx, {
    search: search.slice(0, 200),
    ...(cursor ? { cursor } : {}),
    limit: 20,
  });
  if (!result.ok) throw new Error(result.error);
  return result.value;
}

export async function bioDestinationSectionsAction(
  workspace: string,
  id: string,
) {
  const ctx = await serviceContext(workspace);
  if (!can(ctx.actor, "resource.update")) throw new Error("forbidden");
  const draft = await readBioDraft(ctx, id);
  if (!draft) throw new Error("not_found");
  return {
    revision: draft.revision,
    sections: groupBioLinks(draft.content).blocks.flatMap((block) =>
      block.type === "links"
        ? [
            {
              id: block.id,
              title: block.title,
              count: block.items.length,
              visible: block.visible,
            },
          ]
        : [],
    ),
  };
}

export async function addBioDestinationAction(
  workspace: string,
  id: string,
  input: unknown,
) {
  const result = await addLinksToBioDraft(
    await serviceContext(workspace),
    id,
    input,
  );
  if (result.ok) {
    revalidatePath(`/${workspace}/bio/${id}`);
    revalidatePath(`/${workspace}/bio/${id}/editor`);
  }
  return result;
}
