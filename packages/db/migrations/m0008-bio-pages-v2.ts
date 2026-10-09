import type { AnyBulkWriteOperation, Document } from "mongodb";
import { assetMap, names, oid, report, stableHash, str } from "./helpers";
import type { Migration, MigrationContext } from "./runner";

// Subdomains a bio handle can never take (07), on top of app route names.
const reservedHandles = new Set([
  "www",
  "app",
  "api",
  "admin",
  "staging",
  "mail",
  "smtp",
  "status",
  "docs",
  "help",
  "blog",
  "assets",
  "cdn",
  "cname",
  "static",
  "dashboard",
  "login",
  "register",
  "billing",
  "support",
  "abuse",
  "security",
  "b",
  "qr",
  "go",
  "link",
  "links",
  "shortn",
  "app-staging",
  "api-staging",
  "redirect-origin",
]);

const dnsLabel = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

export function normalizeHandle(slug: string) {
  return (
    slug
      .normalize("NFKD")
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 63)
      .replace(/-+$/g, "") || "page"
  );
}

export const isUsableHandle = (handle: string) =>
  dnsLabel.test(handle) && !reservedHandles.has(handle);

const mapAsset = (url: string | undefined, assets: Map<string, string>) =>
  url ? (assets.get(url) ?? url) : undefined;

// Built only from legacy fields, so a continuous run can rebuild it at any time.
export function buildBio(doc: Document, assets: Map<string, string>) {
  const theme = doc.theme && typeof doc.theme === "object" ? doc.theme : {};
  const header =
    theme.header && typeof theme.header === "object" ? theme.header : {};
  const avatar = mapAsset(str(doc.avatarUrl), assets);
  const socials = (Array.isArray(doc.socials) ? doc.socials : []).flatMap(
    (item: unknown) => {
      if (!item || typeof item !== "object") return [];
      const url = str(Reflect.get(item, "url"));
      const platform = str(Reflect.get(item, "platform"));
      return url && platform ? [{ platform, url }] : [];
    },
  );
  const linkBlocks = (Array.isArray(doc.links) ? doc.links : []).flatMap(
    (item: unknown) => {
      if (!item || typeof item !== "object") return [];
      const linkId = oid(Reflect.get(item, "link"));
      if (!linkId) return [];
      const title = str(Reflect.get(item, "title"));
      const image = mapAsset(str(Reflect.get(item, "image")), assets);
      return [
        {
          type: "link",
          linkId,
          ...(title ? { title } : {}),
          ...(image ? { image } : {}),
        },
      ];
    },
  );
  const blocks = [
    {
      type: "profile",
      ...(str(doc.title) ? { title: doc.title } : {}),
      ...(avatar ? { avatar } : {}),
      ...(str(doc.description) ? { description: doc.description } : {}),
    },
    ...(socials.length ? [{ type: "socials", items: socials }] : []),
    ...linkBlocks,
  ];
  const headerImage = mapAsset(str(header.headerBackgroundImage), assets);
  const appearance = {
    colors: {
      primary: str(theme.primaryColor),
      buttonText: str(theme.buttonTextColor),
      background: str(theme.background),
      text: str(theme.textColor),
      header: str(header.headerBackgroundColor),
      socials: str(doc.socialColor),
    },
    buttonStyle: str(theme.buttonStyle) ?? "rounded",
    avatarShape: str(doc.avatarShape) ?? "circle",
    headerStyle: str(header.headerStyle) ?? "centered",
    ...(headerImage ? { headerImage } : {}),
    // Fonts are curated in the new editor; legacy picks are kept verbatim.
    ...(str(theme.font) ? { customFontFamily: theme.font } : {}),
    typography: {
      titleSize: str(theme.titleFontSize),
      titleWeight: str(theme.titleFontWeight),
      descriptionSize: str(theme.descriptionFontSize),
      descriptionWeight: str(theme.descriptionFontWeight),
      buttonSize: str(theme.buttonFontSize),
      buttonWeight: str(theme.buttonFontWeight),
    },
  };
  return { blocks, appearance, avatar };
}

async function takenHandles(ctx: MigrationContext) {
  const docs = await ctx
    .read(names.bio_pages)
    .find({ handle: { $type: "string" } }, { projection: { handle: 1 } })
    .toArray();
  return new Map(
    docs.flatMap((doc) =>
      str(doc.handle)
        ? [[str(doc.handle) ?? "", String(doc._id)] as const]
        : [],
    ),
  );
}

export const bioPagesV2: Migration = {
  id: "0008-bio-pages-v2",
  phase: "expand",
  continuous: true,
  async up(ctx) {
    if (!(await ctx.exists(names.bio_pages))) return;
    const assets = await assetMap(ctx);
    const taken = await takenHandles(ctx);
    await ctx.batch({
      name: names.bio_pages,
      operations: (docs) =>
        docs.flatMap((doc): AnyBulkWriteOperation<Document>[] => {
          const built = buildBio(doc, assets);
          const bioHash = stableHash({ built, slug: doc.slug });
          let handle = str(doc.handle);
          if (!handle) {
            const slug = str(doc.slug) ?? "";
            const base = isUsableHandle(slug) ? slug : normalizeHandle(slug);
            handle = base;
            for (let n = 2; taken.has(handle) || !isUsableHandle(handle); n++)
              handle = `${base.slice(0, 60 - String(n).length)}-${n}`;
            taken.set(handle, String(doc._id));
          }
          if (doc._sync?.bioHash === bioHash && str(doc.handle)) return [];
          return [
            {
              updateOne: {
                filter: { _id: doc._id },
                update: {
                  $set: {
                    handle,
                    legacySlug: doc.slug,
                    blocks: built.blocks,
                    appearance: built.appearance,
                    published: true,
                    ...(built.avatar ? { avatar: built.avatar } : {}),
                    "_sync.bioHash": bioHash,
                  },
                  ...(built.avatar ? {} : { $unset: { avatar: "" } }),
                },
              },
            },
          ];
        }),
    });
    // Aliases point at the page id, never at a handle string (02 M8).
    await ctx.batch({
      name: names.bio_pages,
      target: names.bio_aliases,
      checkpointId: "biopages__bio_aliases",
      filter: { handle: { $type: "string" } },
      operations: (docs) =>
        docs.flatMap((doc) => {
          const slug = str(doc.slug);
          if (!slug || slug === doc.handle) return [];
          return [
            {
              updateOne: {
                filter: { slug },
                update: {
                  $setOnInsert: {
                    slug,
                    bioPageId: doc._id,
                    createdAt: new Date(),
                  },
                },
                upsert: true,
              },
            },
          ];
        }),
    });
  },
  async verify(ctx) {
    if (!(await ctx.exists(names.bio_pages))) return report({ pages: 0 }, []);
    const pages = await ctx.read(names.bio_pages).find({}).toArray();
    const up = ctx.direction === "up";
    const discrepancies: string[] = [];
    const aliases = (await ctx.exists(names.bio_aliases))
      ? await ctx.read(names.bio_aliases).find({}).toArray()
      : [];
    const aliasBySlug = new Map(
      aliases.map((alias) => [str(alias.slug), String(alias.bioPageId)]),
    );
    for (const page of pages) {
      const id = String(page._id);
      if (!up) {
        if (page.handle || page.blocks)
          discrepancies.push(`page ${id} keeps v2 fields`);
        continue;
      }
      const handle = str(page.handle);
      if (!handle || !dnsLabel.test(handle))
        discrepancies.push(`page ${id} has no valid handle`);
      const expected =
        (Array.isArray(page.links) ? page.links.length : 0) +
        (buildBio(page, new Map()).blocks.some(
          (block) => block.type === "socials",
        )
          ? 1
          : 0) +
        1;
      const blocks = Array.isArray(page.blocks) ? page.blocks.length : 0;
      if (blocks !== expected)
        discrepancies.push(
          `page ${id} has ${blocks} blocks, expected ${expected}`,
        );
      const slug = str(page.slug);
      if (slug && slug !== handle && aliasBySlug.get(slug) !== id)
        discrepancies.push(`slug ${slug} has no alias to its page`);
    }
    return report(
      { pages: pages.length, aliases: aliases.length },
      discrepancies,
    );
  },
  async down(ctx) {
    if (!(await ctx.exists(names.bio_pages))) return;
    await ctx.batch({
      name: names.bio_pages,
      filter: {
        $or: [
          { handle: { $exists: true } },
          { "_sync.bioHash": { $exists: true } },
        ],
      },
      operations: (docs) =>
        docs.map((doc) => ({
          updateOne: {
            filter: { _id: doc._id },
            update: {
              $unset: {
                handle: "",
                legacySlug: "",
                blocks: "",
                appearance: "",
                published: "",
                avatar: "",
                "_sync.bioHash": "",
              },
            },
          },
        })),
    });
    if (await ctx.exists(names.bio_aliases))
      await ctx.batch({
        name: names.bio_aliases,
        operations: (docs) =>
          docs.map((doc) => ({ deleteOne: { filter: { _id: doc._id } } })),
      });
  },
};
