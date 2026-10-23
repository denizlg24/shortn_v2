import { safeBioUrl } from "./urls";
export { safeBioUrl, bioEmbedUrl } from "./urls";
import { z } from "zod";

const url = z.url({ protocol: /^https?$/ }).max(2048);
const identity = {
  id: z.string().min(1).max(100),
  visible: z.boolean().default(true),
  schedule: z
    .object({
      from: z.iso.datetime().optional(),
      to: z.iso.datetime().optional(),
    })
    .refine((v) => !v.from || !v.to || v.from < v.to)
    .optional(),
};
export const bioLinkItemSchema = z.object({
  ...identity,
  linkId: z.string().regex(/^[a-f\d]{24}$/i),
  title: z.string().max(120),
  image: url.or(z.literal("")).default(""),
  highlight: z.boolean().default(false),
  /** When the link joined this section; orders "added" sections. */
  addedAt: z.iso.datetime().optional(),
});
export type BioLinkItem = z.infer<typeof bioLinkItemSchema>;
/**
 * How a links section orders itself on every save: by hand, by link creation
 * time ("newest"), by when each link joined the section ("added"), or A–Z.
 */
export const bioLinkOrders = ["manual", "added", "newest", "title"] as const;
export type BioLinkOrder = (typeof bioLinkOrders)[number];
export const bioBlockSchema = z.discriminatedUnion("type", [
  z.object({
    ...identity,
    type: z.literal("profile"),
    title: z.string().max(120),
    description: z.string().max(500).default(""),
    avatar: url.or(z.literal("")).default(""),
    align: z.enum(["center", "left", "right"]).default("center"),
    avatarShape: z.enum(["circle", "rounded", "square"]).default("circle"),
    paidBadge: z.boolean().optional(),
  }),
  z.object({
    ...identity,
    type: z.literal("link"),
    linkId: z.string().regex(/^[a-f\d]{24}$/i),
    title: z.string().max(120),
    image: url.or(z.literal("")).default(""),
    highlight: z.boolean().default(false),
  }),
  z.object({
    ...identity,
    type: z.literal("links"),
    title: z.string().max(120).default(""),
    layout: z.enum(["vertical", "paginated"]).default("vertical"),
    pageSize: z.number().int().min(4).max(50).default(10),
    cardStyle: z
      .enum(["list", "small-grid", "large-grid", "image-grid"])
      .default("list"),
    cardContent: z
      .enum(["image-text", "image-only", "text"])
      .default("image-text"),
    cardRadius: z.enum(["theme", "square", "rounded"]).default("theme"),
    imageFit: z.enum(["cover", "contain"]).default("cover"),
    linkSurface: z
      .enum(["theme", "minimal", "soft", "filled", "outline"])
      .default("theme"),
    linkBorder: z
      .enum(["theme", "none", "subtle", "solid", "divider"])
      .default("theme"),
    linkWeight: z.enum(["theme", "regular", "medium", "bold"]).default("theme"),
    linkSpacing: z
      .enum(["compact", "comfortable", "spacious"])
      .default("comfortable"),
    showLinkArrow: z.boolean().default(true),
    paginationAppearance: z
      .enum(["muted", "minimal", "outline", "filled"])
      .default("muted"),
    paginationSize: z.enum(["small", "comfortable"]).default("small"),
    paginationStyle: z.enum(["arrows", "labels"]).default("arrows"),
    showPageCount: z.boolean().default(true),
    showLinkCount: z.boolean().default(false),
    order: z.enum(bioLinkOrders).default("manual"),
    items: z.array(bioLinkItemSchema).max(1000),
  }),
  z.object({
    ...identity,
    type: z.literal("socials"),
    items: z
      .array(z.object({ platform: z.string().min(1).max(32), url }))
      .max(20),
  }),
  z.object({
    ...identity,
    type: z.literal("header"),
    text: z.string().max(120),
  }),
  z.object({
    ...identity,
    type: z.literal("text"),
    text: z.string().max(2000),
  }),
  z.object({
    ...identity,
    type: z.literal("image"),
    url: url.or(z.literal("")),
    alt: z.string().max(300),
    link: url.optional(),
  }),
  z.object({
    ...identity,
    type: z.literal("embed"),
    provider: z.enum([
      "youtube",
      "spotify",
      "soundcloud",
      "vimeo",
      "apple-music",
    ]),
    url: url.or(z.literal("")),
  }),
  z.object({
    ...identity,
    type: z.literal("qr"),
    linkId: z.string().regex(/^[a-f\d]{24}$/i),
    title: z.string().max(120).default(""),
  }),
]);
export type BioBlock = z.infer<typeof bioBlockSchema>;
/** One source of defaults for grouping legacy blocks and adding new sections. */
export function newBioLinksSection(
  id: string,
): Extract<BioBlock, { type: "links" }> {
  return bioBlockSchema.parse({
    id,
    type: "links",
    visible: true,
    items: [],
  }) as Extract<BioBlock, { type: "links" }>;
}
export const bioFonts = [
  "Geist",
  "Inter",
  "Roboto",
  "Open Sans",
  "Lato",
  "Montserrat",
  "Poppins",
  "DM Sans",
  "Space Grotesk",
  "Nunito",
  "Raleway",
  "Playfair Display",
  "Merriweather",
  "Lora",
  "Oswald",
  "Source Serif 4",
] as const;
const hex = z.string().regex(/^#[a-f\d]{6}$/i);
export const bioThemeTokens = z.object({
  background: hex,
  surface: hex,
  text: hex,
  accent: hex,
  buttonStyle: z.enum(["fill", "outline", "soft", "shadow-less"]),
  radius: z.union([z.literal(0), z.literal(6), z.literal(12), z.literal(999)]),
  font: z.enum(bioFonts),
  density: z.enum(["comfortable", "compact"]),
  backgroundImage: url.optional(),
  legacyFont: z
    .string()
    .regex(/^[a-zA-Z][a-zA-Z0-9 -]{0,63}$/)
    .optional(),
});
export type BioThemeTokens = z.infer<typeof bioThemeTokens>;
export const bioPresets: Record<string, BioThemeTokens> = Object.fromEntries(
  [
    ["paper", "#fafaf9", "#ffffff", "#1c1917", "#292524"],
    ["ink", "#0f172b", "#1e293b", "#f8fafc", "#cbd5e1"],
    ["clay", "#faf2ec", "#ffffff", "#442b24", "#873f2b"],
    ["forest", "#eef3ed", "#ffffff", "#203b29", "#315c40"],
    ["ocean", "#edf5f8", "#ffffff", "#123c50", "#176180"],
    ["plum", "#f4eff7", "#ffffff", "#402749", "#70477e"],
    ["rose", "#fff1f2", "#ffffff", "#4c1623", "#9d2446"],
    ["sand", "#f8f3e7", "#fffdf7", "#443a23", "#79602b"],
    ["slate", "#f1f5f9", "#ffffff", "#1e293b", "#475569"],
    ["cobalt", "#eff4ff", "#ffffff", "#172554", "#2445a5"],
    ["charcoal", "#242424", "#343434", "#fafafa", "#e5e5e5"],
    ["mint", "#eefbf5", "#ffffff", "#123f32", "#22654e"],
  ].map(([name, background, surface, text, accent]) => [
    name,
    {
      background,
      surface,
      text,
      accent,
      buttonStyle: "fill",
      radius: 12,
      font: "Geist",
      density: "comfortable",
    },
  ]),
);
export const bioContentSchema = z.object({
  locale: z.enum(["en", "pt", "es"]).default("en"),
  blocks: z
    .array(bioBlockSchema)
    .max(150)
    .refine(
      (blocks) =>
        blocks.filter((b) => b.type === "profile").length === 1 &&
        blocks[0]?.type === "profile",
      "One profile must be first",
    )
    .refine(
      (blocks) => new Set(blocks.map((b) => b.id)).size === blocks.length,
      "Block IDs must be unique",
    )
    .refine((blocks) => {
      const ids = blocks.flatMap((b) =>
        b.type === "links" ? [b.id, ...b.items.map((i) => i.id)] : [b.id],
      );
      return new Set(ids).size === ids.length;
    }, "Section and link IDs must be unique")
    .refine(
      (blocks) =>
        blocks.reduce(
          (n, b) =>
            n +
            (b.type === "links" ? b.items.length : b.type === "link" ? 1 : 0),
          0,
        ) <= 2000,
      "A page holds up to 2000 links",
    ),
  theme: bioThemeTokens,
  seo: z.object({
    favicon: url.optional(),
    title: z.string().max(120).default(""),
    description: z.string().max(500).default(""),
    noindex: z.boolean().default(false),
  }),
  hideBranding: z.boolean().default(false),
});
export type BioContent = z.infer<typeof bioContentSchema>;
export type BioResolvedLink = {
  href: string;
  title: string;
  qrImage?: string;
  /** ISO time the short link was created; orders "newest" sections. */
  createdAt?: string;
};
export type PublicBio = {
  id: string;
  handle: string;
  content: BioContent;
  links: Record<string, BioResolvedLink>;
  canonical: string;
  revision: number;
};

function luminance(hex: string) {
  const values = [1, 3, 5]
    .map((at) => parseInt(hex.slice(at, at + 2), 16) / 255)
    .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return values[0]! * 0.2126 + values[1]! * 0.7152 + values[2]! * 0.0722;
}
export function bioContrast(a: string, b: string) {
  const x = luminance(a),
    y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}
export function readableBioColor(text: string, background: string) {
  if (bioContrast(text, background) >= 4.5) return text;
  return bioContrast("#000000", background) >=
    bioContrast("#ffffff", background)
    ? "#000000"
    : "#ffffff";
}
export function accessibleBioTheme(theme: BioThemeTokens): BioThemeTokens {
  return {
    ...theme,
    text: readableBioColor(theme.text, theme.background),
    accent: readableBioColor(theme.accent, theme.surface),
  };
}
export function visibleBioBlock(
  block: Pick<BioBlock, "visible" | "schedule">,
  now: number,
) {
  return (
    block.visible &&
    (!block.schedule?.from || Date.parse(block.schedule.from) <= now) &&
    (!block.schedule?.to || Date.parse(block.schedule.to) > now)
  );
}

const object = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" ? (value as Record<string, unknown>) : {};
const str = (value: unknown) => (typeof value === "string" ? value : "");
function legacyHex(value: unknown, fallback: string) {
  const text = str(value).trim();
  if (/^#[a-f\d]{6}$/i.test(text)) return text;
  if (/^#[a-f\d]{3}$/i.test(text))
    return `#${text
      .slice(1)
      .split("")
      .map((c) => c + c)
      .join("")}`;
  const named: Record<string, string> = {
    black: "#000000",
    white: "#ffffff",
    navy: "#000080",
    red: "#ff0000",
    blue: "#0000ff",
    green: "#008000",
  };
  return named[text] ?? fallback;
}
/** Convert migration evidence without changing stored legacy fields. */
export function migratedBioContent(page: Record<string, unknown>): BioContent {
  const appearance = object(page.appearance),
    legacy = object(page.theme),
    colors = object(appearance.colors),
    header = object(legacy.header);
  const base = bioPresets.paper!;
  const family = str(appearance.customFontFamily || legacy.font);
  const headerStyle = str(appearance.headerStyle || header.headerStyle);
  const theme = accessibleBioTheme({
    ...base,
    background: legacyHex(
      colors.background || legacy.background,
      base.background,
    ),
    surface: legacyHex(colors.background || legacy.background, base.surface),
    text: legacyHex(colors.text || legacy.textColor, base.text),
    accent: legacyHex(colors.primary || legacy.primaryColor, base.accent),
    radius:
      (appearance.buttonStyle || legacy.buttonStyle) === "pill"
        ? 999
        : (appearance.buttonStyle || legacy.buttonStyle) === "square"
          ? 0
          : 12,
    font: bioFonts.find((font) => font === family) ?? "Geist",
    ...(!bioFonts.some((font) => font === family) &&
    /^[a-zA-Z][a-zA-Z0-9 -]{0,63}$/.test(family)
      ? { legacyFont: family }
      : {}),
    ...(safeBioUrl(str(appearance.headerImage || header.headerBackgroundImage))
      ? {
          backgroundImage: safeBioUrl(
            str(appearance.headerImage || header.headerBackgroundImage),
          ),
        }
      : {}),
  });
  const raw = Array.isArray(page.blocks)
    ? page.blocks
    : [
        {
          type: "profile",
          title: str(page.title),
          description: str(page.description),
          avatar: str(page.avatarUrl || page.avatar),
        },
        {
          type: "socials",
          items: Array.isArray(page.socials) ? page.socials : [],
        },
        ...(Array.isArray(page.links)
          ? page.links.map((item) => ({
              ...object(item),
              type: "link",
              linkId: object(item).link,
            }))
          : []),
      ];
  const blocks: BioBlock[] = raw.flatMap((value, index) => {
    const item = object(value),
      type = str(item.type);
    const candidate = {
      ...item,
      id: str(item.id) || `${type}-${index}`,
      visible: item.visible !== false,
      ...(type === "profile"
        ? {
            title: str(item.title || page.title),
            description: str(item.description || page.description),
            avatar: safeBioUrl(str(item.avatar || page.avatar)) ?? "",
            align:
              headerStyle === "left-aligned"
                ? "left"
                : headerStyle === "right-aligned"
                  ? "right"
                  : "center",
            avatarShape: appearance.avatarShape || page.avatarShape || "circle",
          }
        : {}),
      ...(type === "link" || type === "qr"
        ? {
            linkId: String(item.linkId),
            title: str(item.title).slice(0, 120),
            image: safeBioUrl(str(item.image)) ?? "",
          }
        : {}),
      ...(type === "socials"
        ? {
            items: (Array.isArray(item.items) ? item.items : []).flatMap(
              (social) => {
                const platform = str(object(social).platform).slice(0, 32),
                  url = legacySocialUrl(str(object(social).url));
                return platform && url ? [{ platform, url }] : [];
              },
            ),
          }
        : {}),
    };
    const parsed = bioBlockSchema.safeParse(candidate);
    return parsed.success ? [parsed.data] : [];
  });
  if (blocks[0]?.type !== "profile")
    blocks.unshift({
      id: "profile",
      visible: true,
      type: "profile",
      title: str(page.title),
      description: str(page.description),
      avatar: "",
      align: "center",
      avatarShape: "circle",
    });
  const seo = object(page.seo);
  return groupBioLinks({
    locale: page.locale === "pt" || page.locale === "es" ? page.locale : "en",
    blocks,
    theme,
    seo: {
      title: str(seo.title),
      description: str(seo.description),
      noindex: seo.noindex === true,
    },
    hideBranding: false,
  });
}
/** Legacy socials were often saved without a scheme ("instagram.com/me"). */
function legacySocialUrl(value: string) {
  const text = value.trim();
  if (!text || text.length > 2048) return undefined;
  return /^[a-z][a-z\d+.-]*:(?!\d)/i.test(text)
    ? safeBioUrl(text)
    : safeBioUrl(`https://${text}`);
}

/** Collect nested references once for ownership checks and public resolution. */
export function bioLinkIds(content: BioContent) {
  return [
    ...new Set(
      content.blocks.flatMap((b) =>
        b.type === "links"
          ? b.items.map((i) => i.linkId)
          : b.type === "link" || b.type === "qr"
            ? [b.linkId]
            : [],
      ),
    ),
  ];
}
/** Present older individual link blocks as collections, keeping attribution IDs. */
export function groupBioLinks(content: BioContent): BioContent {
  const blocks: BioBlock[] = [];
  let previousLegacy = false;
  const used = new Set(
    content.blocks.flatMap((b) =>
      b.type === "links" ? [b.id, ...b.items.map((i) => i.id)] : [b.id],
    ),
  );
  for (const block of content.blocks) {
    if (block.type !== "link") {
      blocks.push(block);
      previousLegacy = false;
      continue;
    }
    const last = blocks.at(-1);
    const item: BioLinkItem = {
      id: block.id,
      linkId: block.linkId,
      title: block.title,
      image: block.image,
      visible: block.visible,
      highlight: block.highlight,
      ...(block.schedule ? { schedule: block.schedule } : {}),
    };
    if (previousLegacy && last?.type === "links" && last.items.length < 1000)
      last.items.push(item);
    else {
      const base = `collection-${block.id}`.slice(0, 85);
      let id = base,
        suffix = 1;
      while (used.has(id)) id = `${base}-${suffix++}`;
      used.add(id);
      blocks.push({ ...newBioLinksSection(id), items: [item] });
    }
    previousLegacy = true;
  }
  return { ...content, blocks };
}

export interface BioLinkFacts {
  /** ISO creation time of the short link. */
  createdAt?: string | undefined;
  /** The link's own title, shown when the item has none. */
  title?: string | undefined;
}

const titleCollator = new Intl.Collator("en", {
  sensitivity: "base",
  numeric: true,
});

/** Newest ISO time first; items without one keep their order, last. */
const byTimeDesc = (x: string | undefined, y: string | undefined) =>
  x === y ? 0 : !x ? 1 : !y ? -1 : x < y ? 1 : -1;

/**
 * Applies each automatically ordered section's order. Sorting is stable, so
 * ties keep their current relative order. Returns the same object when
 * nothing moves, so callers can compare by identity.
 */
export function orderBioLinks(
  content: BioContent,
  facts: (linkId: string) => BioLinkFacts | undefined,
): BioContent {
  let changed = false;
  const blocks = content.blocks.map((block) => {
    if (block.type !== "links" || block.order === "manual") return block;
    const compare: (a: BioLinkItem, b: BioLinkItem) => number =
      block.order === "added"
        ? (a, b) => byTimeDesc(a.addedAt, b.addedAt)
        : block.order === "newest"
          ? (a, b) =>
              byTimeDesc(facts(a.linkId)?.createdAt, facts(b.linkId)?.createdAt)
          : (a, b) =>
              titleCollator.compare(
                a.title.trim() || facts(a.linkId)?.title || "",
                b.title.trim() || facts(b.linkId)?.title || "",
              );
    const items = [...block.items].sort(compare);
    if (items.every((item, at) => item === block.items[at])) return block;
    changed = true;
    return { ...block, items };
  });
  return changed ? { ...content, blocks } : content;
}

/**
 * Sections saved before items carried `addedAt` list links in the order they
 * were appended. Stamping that order with old, increasing times lets "Recently
 * added" put the latest additions first without moving them twice.
 */
export function stampBioLinksAdded(items: BioLinkItem[]): BioLinkItem[] {
  if (items.every((item) => item.addedAt)) return items;
  const base = Date.UTC(2000, 0, 1);
  return items.map((item, at) =>
    item.addedAt
      ? item
      : { ...item, addedAt: new Date(base + at * 1000).toISOString() },
  );
}
