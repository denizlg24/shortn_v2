import { test, expect } from "bun:test";
import {
  linkListQueryOf,
  linksViewQuery,
  linksViewSearch,
} from "./link-list-query";

test("Links and export share bounded full-tag, status, UTC date and sort scope across pages", () => {
  const tag = "T".repeat(64),
    query = {
      q: "newsletter",
      tag: [tag, "São João"],
      status: "password",
      created: "custom",
      from: "2026-10-10",
      to: "2026-10-12",
      sort: "clicks",
      trash: "1",
      page: "2",
      deleted: "5",
      selection: "not-a-filter",
    };
  const view = linksViewQuery(query, new Date("2026-10-15T00:00:00Z"));
  expect(view.filter).toEqual({
    search: "newsletter",
    tags: [tag, "São João"],
    status: "password",
    createdAfter: new Date("2026-10-10T00:00:00Z"),
    createdBefore: new Date("2026-10-13T00:00:00Z"),
    sort: "clicks",
    trash: true,
  });
  expect(view.page).toBe(2);
  const search = new URLSearchParams(linksViewSearch(query));
  expect(search.getAll("tag")).toEqual([tag, "São João"]);
  for (const ignored of ["page", "deleted", "selection"])
    expect(search.has(ignored)).toBe(false);
  expect(
    linksViewQuery(Object.fromEntries(search), new Date("2026-10-15T00:00:00Z"))
      .filter.createdBefore,
  ).toEqual(view.filter.createdBefore);
});
test("untrusted URL values cannot select unsupported filters or unbounded pages", () => {
  const view = linksViewQuery(
    {
      status: "not-supported",
      sort: "bad",
      page: "Infinity",
      q: "x".repeat(500),
      tag: Array.from({ length: 60 }, (_, i) => `${i}`.padEnd(90, "t")),
    },
    new Date(),
  );
  expect(view.filter.status).toBeUndefined();
  expect(view.filter.sort).toBe("newest");
  expect(view.page).toBe(1);
  expect(view.filter.search).toHaveLength(200);
  expect(view.filter.tags).toHaveLength(50);
  expect(view.filter.tags![0]).toHaveLength(64);
});
test("archived view survives export navigation while trash takes precedence", () => {
  const query = { archived: "1", tag: "Keep", page: "2" };
  expect(linksViewQuery(query, new Date()).filter.archived).toBe(true);
  expect(new URLSearchParams(linksViewSearch(query)).get("archived")).toBe("1");
  expect(
    linksViewQuery({ ...query, trash: "1" }, new Date()).filter.archived,
  ).toBeUndefined();
});
test("domain, campaign, untagged and all-of tags are validated and round-trip through export links", () => {
  const campaign = "A".repeat(24),
    query = {
      tag: ["Print", "Promo", "Print"],
      tagMode: "all",
      untagged: "1",
      domain: " Go.Example.com ",
      campaign,
    };
  const view = linksViewQuery(query, new Date());
  expect(view.filter).toMatchObject({
    tags: ["Print", "Promo"],
    tagMode: "all",
    domain: "go.example.com",
    campaign: campaign.toLowerCase(),
  });
  expect(view.filter.untagged).toBeUndefined();
  expect(view.filtered).toBe(true);
  const search = new URLSearchParams(linksViewSearch(query));
  for (const key of ["tagMode", "untagged", "domain", "campaign"])
    expect(search.has(key)).toBe(true);
  expect(
    linksViewQuery(linkListQueryOf(search.toString()), new Date()).filter,
  ).toEqual(view.filter);
  const anyOf = linksViewQuery({ untagged: "1", tag: "Print" }, new Date());
  expect([anyOf.filter.untagged, anyOf.filter.tagMode]).toEqual([
    true,
    undefined,
  ]);
  expect(
    linksViewQuery({ tagMode: "all", untagged: "1" }, new Date()).filter,
  ).toMatchObject({ untagged: true });
  const hostile = linksViewQuery(
    { domain: "a b/../", campaign: "not-an-id", tagMode: "every" },
    new Date(),
  );
  for (const key of ["domain", "campaign", "tagMode"] as const)
    expect(hostile.filter[key]).toBeUndefined();
  expect(hostile.filtered).toBe(false);
});
