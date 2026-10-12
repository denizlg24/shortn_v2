# packages/core/tags/service.ts

- Tag · type · L7-L7 — type Tag = Documents["tags"];
- TagRef · interface · L9-L13 — interface TagRef
- tagName · function · L15-L16 — tagName = (tag: Pick<Tag, "name" | "tagName">)
- normalizeTagName · function · L18-L19 — normalizeTagName = (name: string)
- listTags · function · L21-L35 — async function listTags(ctx: Pick<ServiceContext, "db" | "workspace">)
- ensureTags · function · L39-L101 — async function ensureTags( ctx: ServiceContext, names: string[], ): Promise<TagRef[]>
- embeddedTags · function · L104-L110 — embeddedTags = (refs: TagRef[], sub: string | undefined)
