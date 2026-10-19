import { expect, test } from "bun:test";
import { isTagMatchMode, linkDomainFilter } from "./filters";
import { tagColorOf, isTagSort } from "../tags/options";

test("domain filter values are lowercase bounded hostnames, ports allowed for local link domains", () => {
  expect(linkDomainFilter(" Go.Example.COM ")).toBe("go.example.com");
  expect(linkDomainFilter("localhost:3102")).toBe("localhost:3102");
  for (const value of ["", "a b", "-x.com", "x.com/", "x".repeat(254), 7])
    expect(linkDomainFilter(value)).toBeNull();
});

test("tag modes, sorts and colours only accept their fixed vocabularies", () => {
  expect([isTagMatchMode("all"), isTagMatchMode("none")]).toEqual([
    true,
    false,
  ]);
  expect([isTagSort("name"), isTagSort("links")]).toEqual([true, false]);
  expect([
    tagColorOf("teal"),
    tagColorOf("#ff0000"),
    tagColorOf(undefined),
  ]).toEqual(["teal", "slate", "slate"]);
});
