import { expect, test } from "bun:test";
import { encodeSecret, type CachedLink, type ClickMessage } from "@shortn/core";
import { parseWorkspaceSuspension } from "@shortn/redis";
import { createApp } from "./app";
import { createSuspensionSet } from "./suspensions";

const workspace = "0123456789abcdef01234567";
const link: CachedLink = {
  kind: "link",
  id: "abcdefabcdefabcdefabcdef",
  ws: workspace,
  key: "abc",
  dest: "https://example.com/x",
  status: "ok",
  pwd: false,
};

function app(suspended: { has(id: string): boolean }) {
  const enqueued: ClickMessage[] = [];
  return {
    enqueued,
    app: createApp({
      resolver: { resolve: async () => link },
      suspended,
      enqueue: (message) => enqueued.push(message),
      health: async () => true,
      secrets: { legacy: encodeSecret("legacy-secret") },
      origin: "https://shortn.at",
      linkDomain: "shortn.at",
      log: () => {},
    }),
  };
}

test("a suspended workspace's link goes to the safety page and records no click", async () => {
  const { app: blocked, enqueued } = app({ has: (id) => id === workspace });
  const response = await blocked.request("/abc");
  expect(response.status).toBe(302);
  expect(response.headers.get("location")).toBe(
    "https://shortn.at/en/safety/abc",
  );
  expect(enqueued).toHaveLength(0);
  const { app: active } = app({ has: () => false });
  expect((await active.request("/abc")).headers.get("location")).toBe(
    "https://example.com/x",
  );
});

test("the set applies messages at once and a reload replaces it", async () => {
  let rows = [workspace];
  const set = createSuspensionSet(async () => rows, { log: () => {} });
  expect(set.has(workspace)).toBe(false);
  await set.reload();
  expect(set.has(workspace)).toBe(true);
  set.apply({ workspaceId: workspace, suspended: false });
  expect(set.has(workspace)).toBe(false);
  set.apply({ workspaceId: "f".repeat(24), suspended: true });
  expect(set.has("f".repeat(24))).toBe(true);
  rows = [];
  await set.reload();
  expect(set.size).toBe(0);
});

test("a failing load fails open and keeps the last known state", async () => {
  let fail = true;
  const errors: unknown[] = [];
  const set = createSuspensionSet(
    async () => {
      if (fail) throw new Error("mongo down");
      return [workspace];
    },
    { log: (_message, error) => errors.push(error) },
  );
  expect(await set.reload()).toBe(false);
  expect(set.loaded).toBe(false);
  expect(set.has(workspace)).toBe(false);
  fail = false;
  expect(await set.reload()).toBe(true);
  fail = true;
  expect(await set.reload()).toBe(false);
  expect(set.has(workspace)).toBe(true);
  expect(errors).toHaveLength(2);
});

test("a message during a reload wins over the older snapshot", async () => {
  let release: (rows: string[]) => void = () => {};
  const set = createSuspensionSet(
    () => new Promise<string[]>((resolve) => (release = resolve)),
  );
  const pending = set.reload();
  set.apply({ workspaceId: workspace, suspended: true });
  release([]);
  await pending;
  expect(set.has(workspace)).toBe(true);
});

test("suspension messages are validated", () => {
  expect(
    parseWorkspaceSuspension(
      JSON.stringify({ workspaceId: workspace, suspended: true }),
    ),
  ).toEqual({ workspaceId: workspace, suspended: true });
  for (const payload of [
    "not json",
    JSON.stringify({ workspaceId: "x", suspended: true }),
    JSON.stringify({ workspaceId: workspace, suspended: "yes" }),
    "null",
  ])
    expect(parseWorkspaceSuspension(payload)).toBeNull();
});
