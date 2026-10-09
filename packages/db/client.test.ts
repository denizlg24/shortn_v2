import { expect, test } from "bun:test";
import { closeMongoClient, getMongoClient } from "./client";
test("singleton shares an in-flight client, refuses reconfiguration and closes", async () => {
  // The discarded loopback port is deliberately unreachable; no database is contacted.
  const config = {
    url: "mongodb://127.0.0.1:1/?serverSelectionTimeoutMS=10&connectTimeoutMS=10",
    database: "shortn_test",
    maxPoolSize: 2,
  };
  const first = getMongoClient(config);
  const second = getMongoClient(config);
  expect(first).toBe(second);
  expect(() => getMongoClient({ ...config, maxPoolSize: 3 })).toThrow(
    "configured differently",
  );
  const results = await Promise.allSettled([first, second]);
  expect(results.every((result) => result.status === "rejected")).toBe(true);
  await closeMongoClient();
});

test("an old failed connection cannot clear a newer singleton after close", async () => {
  const config = {
    url: "mongodb://127.0.0.1:1/?serverSelectionTimeoutMS=300&connectTimeoutMS=10",
    database: "fixture",
  };
  const old = getMongoClient(config);
  const settledOld = Promise.allSettled([old]);
  await closeMongoClient();
  const fresh = getMongoClient({
    ...config,
    url: "mongodb://127.0.0.1:1/?serverSelectionTimeoutMS=1000&connectTimeoutMS=10",
  });
  const settledFresh = Promise.allSettled([fresh]);
  await settledOld;
  expect(
    getMongoClient({
      ...config,
      url: "mongodb://127.0.0.1:1/?serverSelectionTimeoutMS=1000&connectTimeoutMS=10",
    }),
  ).toBe(fresh);
  await closeMongoClient();
  await settledFresh;
});
