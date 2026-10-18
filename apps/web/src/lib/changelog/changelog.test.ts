import { describe, expect, test } from "bun:test";
import { minimumPlanFor } from "@shortn/billing/catalog";
import en from "../../../messages/en/index";
import es from "../../../messages/es/index";
import pt from "../../../messages/pt/index";
import { writeStored } from "../browser-store";
import { failingSources, memorySource } from "../test-stores";
import {
  changelog,
  itemTag,
  latestEntry,
  type ChangelogEntry,
} from "./entries";
import {
  changelogSeenKey,
  markChangelogSeen,
  seenStatus,
  shouldAutoOpen,
} from "./seen";

const locales = [
  ["en", en],
  ["pt", pt],
  ["es", es],
] as const;

function messageAt(messages: unknown, path: readonly string[]): unknown {
  let node: unknown = messages;
  for (const key of path)
    node =
      typeof node === "object" && node !== null
        ? Reflect.get(node, key)
        : undefined;
  return node;
}

const keysAt = (messages: unknown, path: readonly string[]) => {
  const node = messageAt(messages, path);
  return typeof node === "object" && node !== null
    ? Object.keys(node).sort()
    : [];
};

describe("seen state", () => {
  test("is unseen until the latest entry is marked", () => {
    const source = memorySource();
    expect(seenStatus(source, latestEntry.id)).toBe("unseen");
    writeStored(source, changelogSeenKey, "an-older-release");
    expect(seenStatus(source, latestEntry.id)).toBe("unseen");
    expect(markChangelogSeen(source, latestEntry.id)).toBe(true);
    expect(seenStatus(source, latestEntry.id)).toBe("seen");
  });

  test.each(failingSources)(
    "is unavailable and never throws: %s",
    (_, source) => {
      expect(seenStatus(source, latestEntry.id)).toBe("unavailable");
      expect(markChangelogSeen(source, latestEntry.id)).toBe(false);
    },
  );

  test("opens the dialog by itself only for an unseen release", () => {
    const open = (
      status: "seen" | "unseen" | "unavailable",
      impersonating = false,
      tourActive = false,
    ) => shouldAutoOpen({ status, impersonating, tourActive });
    expect(open("unseen")).toBe(true);
    expect(open("seen")).toBe(false);
    expect(open("unavailable")).toBe(false);
    expect(open("unseen", true)).toBe(false);
    expect(open("unseen", false, true)).toBe(false);
  });
});

describe("changelog entries", () => {
  test("are newest first, with real dates and unique ids", () => {
    const dates = changelog.map((entry) => entry.date);
    for (const date of dates) {
      expect(date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10)).toBe(
        date,
      );
    }
    expect(dates).toEqual([...dates].sort().reverse());
    const ids = changelog.map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test.each(changelog.map((entry) => [entry.id, entry] as const))(
    "%s has unique sections, items and highlights",
    (_, entry) => {
      const sections = entry.sections.map((section) => section.id);
      const items = entry.sections.flatMap((section) =>
        section.items.map((item) => item.id),
      );
      expect(new Set(sections).size).toBe(sections.length);
      expect(new Set(items).size).toBe(items.length);
      expect(new Set(entry.highlights).size).toBe(entry.highlights.length);
      expect(entry.highlights.length).toBeGreaterThan(0);
    },
  );

  describe.each(locales)("%s copy", (_, messages) => {
    test.each(changelog.map((entry) => [entry.id, entry] as const))(
      "covers %s exactly",
      (_, entry) => {
        const base = ["changelog", "entries", entry.id];
        for (const key of ["title", "summary"])
          expect(messageAt(messages, [...base, key])).toBeTruthy();
        expect(keysAt(messages, [...base, "sections"])).toEqual(
          entry.sections.map((section) => section.id).sort(),
        );
        expect(keysAt(messages, [...base, "items"])).toEqual(
          entry.sections
            .flatMap((section) => section.items.map((item) => item.id))
            .sort(),
        );
        expect(keysAt(messages, [...base, "highlights"])).toEqual(
          [...entry.highlights].sort(),
        );
        for (const section of entry.sections) {
          expect(
            messageAt(messages, [...base, "sections", section.id]),
          ).toBeTruthy();
          for (const item of section.items)
            for (const key of ["title", "body"])
              expect({
                item: item.id,
                key,
                copy: Boolean(
                  messageAt(messages, [...base, "items", item.id, key]),
                ),
              }).toEqual({ item: item.id, key, copy: true });
        }
        for (const id of entry.highlights)
          for (const key of ["title", "body"])
            expect(
              messageAt(messages, [...base, "highlights", id, key]),
            ).toBeTruthy();
      },
    );

    test("has no copy for entries that don't exist", () => {
      expect(keysAt(messages, ["changelog", "entries"])).toEqual(
        changelog.map((entry) => entry.id).sort(),
      );
    });
  });

  test("plan tags follow the billing catalog", () => {
    const entries: readonly ChangelogEntry[] = changelog;
    const items = entries.flatMap((entry) =>
      entry.sections.flatMap((section) => section.items),
    );
    for (const item of items) {
      expect({
        item: item.id,
        both: item.feature !== undefined && item.tag !== undefined,
      }).toEqual({ item: item.id, both: false });
      if (item.feature) {
        const plan = minimumPlanFor(item.feature);
        expect(itemTag(item)).toBe(plan === "free" ? null : plan);
      }
    }
    expect(itemTag({ id: "untagged" })).toBeNull();
    expect(itemTag({ id: "domains", tag: "addon" })).toBe("addon");
    expect(itemTag({ id: "passwords", feature: "passwords" })).toBe("pro");
  });
});
