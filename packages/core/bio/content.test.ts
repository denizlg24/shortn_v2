import { expect, test } from "bun:test";
import {
  newBioLinksSection,
  groupBioLinks,
  bioLinkIds,
  accessibleBioTheme,
  bioContrast,
  bioContentSchema,
  bioEmbedUrl,
  bioPresets,
  migratedBioContent,
  safeBioUrl,
  visibleBioBlock,
} from "./content";
import { bioHandleFromHost, validBioHandle } from "./hosts";
test("all presets meet text contrast, including user color corrections", () => {
  for (const preset of Object.values(bioPresets)) {
    const theme = accessibleBioTheme(preset);
    expect(bioContrast(theme.text, theme.background)).toBeGreaterThanOrEqual(
      4.5,
    );
    expect(bioContrast(theme.accent, theme.surface)).toBeGreaterThanOrEqual(
      4.5,
    );
  }
  expect(
    bioContrast(
      accessibleBioTheme({ ...bioPresets.paper!, text: "#fafafa" }).text,
      "#fafaf9",
    ),
  ).toBeGreaterThanOrEqual(4.5);
});
test("migration preserves content, legacy fonts, alignment and link order", () => {
  const content = migratedBioContent({
    title: "Edição — São João / España",
    appearance: {
      customFontFamily: "Alegreya Sans",
      headerStyle: "right-aligned",
      colors: { text: "#fff", background: "#fff" },
    },
    blocks: [
      {
        type: "profile",
        title: "Edição",
        description: "A long description",
        avatar: "https://example.com/me.jpg",
      },
      { type: "link", linkId: "123456789012345678901234", title: "Read this" },
    ],
  });
  expect(content.theme.legacyFont).toBe("Alegreya Sans");
  expect(content.blocks[0]).toMatchObject({
    title: "Edição",
    description: "A long description",
    align: "right",
  });
  expect(content.blocks[1]).toMatchObject({
    linkId: "123456789012345678901234",
    title: "Read this",
  });
  expect(bioContentSchema.safeParse(content).success).toBe(true);
});
test("schedule boundaries are inclusive at start, exclusive at end", () => {
  const block = {
    type: "text" as const,
    id: "a",
    text: "hello",
    visible: true,
    schedule: { from: "2026-10-12T10:00:00Z", to: "2026-10-12T11:00:00Z" },
  };
  expect(visibleBioBlock(block, Date.parse(block.schedule.from) - 1)).toBe(
    false,
  );
  expect(visibleBioBlock(block, Date.parse(block.schedule.from))).toBe(true);
  expect(visibleBioBlock(block, Date.parse(block.schedule.to))).toBe(false);
});
test("unsafe URLs and impostor embed hosts cannot become active content", () => {
  for (const url of [
    "javascript:alert(1)",
    "data:text/html,hi",
    "https://user:password@example.com",
    "/relative",
  ])
    expect(safeBioUrl(url)).toBeUndefined();
  expect(
    bioEmbedUrl("youtube", "https://youtube.com.evil.test/watch?v=dQw4w9WgXcQ"),
  ).toBeUndefined();
  expect(bioEmbedUrl("youtube", "https://youtu.be/dQw4w9WgXcQ")).toBe(
    "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ",
  );
  expect(bioEmbedUrl("spotify", "https://open.spotify.com/track/abc123")).toBe(
    "https://open.spotify.com/embed/track/abc123",
  );
});
test("new handles use strict lengths; migrated labels keep DNS lengths", () => {
  expect(validBioHandle("a")).toBe(false);
  expect(validBioHandle("a", true)).toBe(true);
  expect(validBioHandle("a".repeat(31))).toBe(false);
  expect(validBioHandle("a".repeat(63), true)).toBe(true);
  for (const name of [
    "app",
    "cname",
    "api-staging",
    "-bob",
    "bob-",
    "bob.alice",
  ])
    expect(validBioHandle(name, true)).toBe(false);
  expect(bioHandleFromHost("alice.shortn.at", "shortn.at")).toBe("alice");
  expect(bioHandleFromHost("alice.staging.shortn.at", "shortn.at")).toBeNull();
});

test("collections scale to hundreds of links and preserve legacy attribution and schedules", () => {
  const migrated = migratedBioContent({ title: "Directory" });
  const legacy = { ...migrated, blocks: migrated.blocks.slice(0, 1) };
  const items = Array.from({ length: 250 }, (_, i) => ({
    id: `item-${i}`,
    visible: i !== 0,
    type: "link" as const,
    linkId: (i + 1).toString(16).padStart(24, "0"),
    title: `Resource ${i}`,
    image: "",
    highlight: false,
    ...(i === 1 ? { schedule: { from: "2026-10-12T10:00:00Z" } } : {}),
  }));
  const input = { ...legacy, blocks: [...legacy.blocks, ...items] };
  const grouped = groupBioLinks(input);
  expect(bioContentSchema.safeParse(grouped).success).toBe(true);
  expect(grouped.blocks).toHaveLength(2);
  expect(grouped.blocks[1]).toMatchObject({
    type: "links",
    layout: "vertical",
  });
  expect(bioLinkIds(grouped)).toHaveLength(250);
  expect(groupBioLinks(grouped)).toEqual(grouped);
  expect(input.blocks).toHaveLength(251);
  const collection = grouped.blocks[1];
  if (collection?.type !== "links") throw new Error("missing collection");
  expect(collection.items[0]!.id).toBe(items[0]!.id);
  expect(collection.items[1]!.schedule).toEqual(items[1]!.schedule);
  expect(
    bioContentSchema.safeParse({
      ...grouped,
      blocks: [
        grouped.blocks[0],
        { ...collection, items: [collection.items[0], collection.items[0]] },
      ],
    }).success,
  ).toBe(false);
  expect(
    bioContentSchema.safeParse({
      ...grouped,
      blocks: [grouped.blocks[0], { ...collection, pageSize: 0 }],
    }).success,
  ).toBe(false);
});

test("new and older collections share complete controlled-input defaults", () => {
  const section = newBioLinksSection("new-section");
  expect(section.showPageCount).toBe(true);
  expect(section.showLinkCount).toBe(false);
  expect(section.showLinkArrow).toBe(true);
  expect(section.paginationAppearance).toBe("muted");
  expect(section.paginationSize).toBe("small");
  const base = migratedBioContent({ title: "Defaults" });
  const older = bioContentSchema.parse({
    ...base,
    blocks: [base.blocks[0], { id: section.id, type: "links", items: [] }],
  });
  expect(older.blocks[1]).toEqual(section);
});
