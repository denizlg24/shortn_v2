import { describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { documentation } from "@shortn/docs";
import en from "../../../messages/en/index";
import es from "../../../messages/es/index";
import pt from "../../../messages/pt/index";
import { tourAnchors } from "./anchors";
import {
  docsHref,
  stepHref,
  tourSteps,
  type TourPage,
  type TourStep,
} from "./steps";

const src = join(import.meta.dir, "../..");
const steps: readonly TourStep[] = tourSteps;

const locales = [
  ["en", en],
  ["pt", pt],
  ["es", es],
] as const;

const routeFile = (page: TourPage) => join(src, "app", page, "page.tsx");

/** Anchor ids spread or passed as props anywhere in the app, outside the tour's own registry. */
async function renderedAnchors() {
  const found = new Set<string>();
  const pattern =
    /tourAnchor\("([a-z-]+)"\)|\b(?:tabsAnchor|anchor)="([a-z-]+)"/g;
  for await (const file of new Bun.Glob("**/*.tsx").scan(src)) {
    if (file.endsWith(".test.tsx")) continue;
    const code = await Bun.file(join(src, file)).text();
    for (const match of code.matchAll(pattern))
      found.add(match[1] ?? match[2] ?? "");
  }
  return found;
}

describe("tour steps", () => {
  test("have unique ids", () => {
    const ids = steps.map((step) => step.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test.each(locales)(
    "have copy in %s, and only for real steps",
    (_, messages) => {
      const copy = messages.tour.steps;
      expect(Object.keys(copy).sort()).toEqual(
        steps.map((step) => step.id).sort(),
      );
      for (const [id, step] of Object.entries(copy)) {
        expect({ id, title: Boolean(step.title.trim()) }).toEqual({
          id,
          title: true,
        });
        expect({ id, body: Boolean(step.body.trim()) }).toEqual({
          id,
          body: true,
        });
      }
    },
  );

  test("visit routes that exist", () => {
    for (const step of steps) {
      if (step.page)
        expect({
          step: step.id,
          exists: existsSync(routeFile(step.page)),
        }).toEqual({ step: step.id, exists: true });
      if (step.entity)
        expect({
          step: step.id,
          fallback: existsSync(routeFile(step.entity.fallback)),
        }).toEqual({ step: step.id, fallback: true });
    }
  });

  test("name the entity for every detail page, and only for those", () => {
    for (const step of steps) {
      const detail = step.page?.includes("[id]") ?? false;
      expect({ step: step.id, entity: Boolean(step.entity) }).toEqual({
        step: step.id,
        entity: detail,
      });
      expect(step.entity?.fallback.includes("[id]") ?? false).toBe(false);
    }
  });

  test("point at anchors that are rendered in the app", async () => {
    const rendered = await renderedAnchors();
    for (const anchor of tourAnchors)
      expect({ anchor, rendered: rendered.has(anchor) }).toEqual({
        anchor,
        rendered: true,
      });
    const known = new Set<string>(tourAnchors);
    for (const anchor of rendered)
      expect({ anchor, known: known.has(anchor) }).toEqual({
        anchor,
        known: true,
      });
    const used = new Set(steps.flatMap((step) => step.anchor ?? []));
    expect([...used].sort()).toEqual([...tourAnchors].sort());
  });

  test("link to docs that exist in every locale", () => {
    for (const step of steps) {
      if (!step.docs) continue;
      const docs = step.docs;
      if ("guide" in docs)
        for (const [locale] of locales)
          expect({
            step: step.id,
            locale,
            exists: Object.hasOwn(
              documentation.pages,
              `${locale}/guides/${docs.guide}`,
            ),
          }).toEqual({ step: step.id, locale, exists: true });
      else
        expect({
          step: step.id,
          exists:
            docs.page === "api" ||
            Object.hasOwn(documentation.pages, docs.page),
        }).toEqual({ step: step.id, exists: true });
    }
  });
});

describe("step links", () => {
  const targets = { link: "lnk 1", qr: "qr_1", bio: null };

  test("stay on the current page without a route", () => {
    expect(stepHref({ id: "finish" }, "acme", targets)).toBeNull();
  });

  test("fill detail pages with the newest entity, encoded", () => {
    expect(
      stepHref(
        {
          id: "linkPages",
          page: "/[workspace]/links/[id]",
          entity: { kind: "link", fallback: "/[workspace]/links" },
        },
        "my team",
        targets,
      ),
    ).toEqual({ href: "/my%20team/links/lnk%201", missingEntity: null });
  });

  test("fall back to the list when the workspace has none", () => {
    expect(
      stepHref(
        {
          id: "bio",
          page: "/[workspace]/bio/[id]/editor",
          entity: { kind: "bio", fallback: "/[workspace]/bio" },
        },
        "acme",
        targets,
      ),
    ).toEqual({ href: "/acme/bio", missingEntity: "bio" });
  });

  test("open localized guides and English reference pages", () => {
    expect(docsHref({ guide: "links/creating-links" }, "pt")).toBe(
      "/docs/pt/guides/links/creating-links",
    );
    expect(docsHref({ page: "webhooks" }, "pt")).toBe("/docs/webhooks");
  });
});
