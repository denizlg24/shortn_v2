import { describe, expect, test } from "bun:test";
import { writeStored } from "../browser-store";
import { failingSources, memorySource } from "../test-stores";
import {
  parseProgress,
  progressOnLoad,
  readProgress,
  serializeProgress,
  tourProgressKey,
  writeProgress,
  type TourProgress,
} from "./progress";

const steps = 22;

describe("tour progress", () => {
  test.each([
    { status: "idle" },
    { status: "active", step: 0 },
    { status: "paused", step: 21 },
    { status: "done" },
  ] satisfies TourProgress[])("round-trips %o", (progress) => {
    expect(parseProgress(serializeProgress(progress), steps)).toEqual(progress);
  });

  test.each([
    ["nothing stored", null],
    ["unknown status", "running:3"],
    ["not a number", "paused:three"],
    ["negative step", "paused:-1"],
    ["step past the end", "paused:22"],
    ["oversized step", "paused:1000"],
    ["trailing text", "done!"],
  ])("treats %s as never started", (_, raw) => {
    expect(parseProgress(raw, steps)).toEqual({ status: "idle" });
  });

  test("a step removed from the tour since it was saved restarts it", () => {
    expect(parseProgress("paused:21", 20)).toEqual({ status: "idle" });
  });

  test("a reloaded tab offers to resume instead of reopening the overlay", () => {
    expect(progressOnLoad({ status: "active", step: 4 })).toEqual({
      status: "paused",
      step: 4,
    });
    const done: TourProgress = { status: "done" };
    expect(progressOnLoad(done)).toBe(done);
  });

  test("is stored under its key and cleared when idle", () => {
    const source = memorySource();
    writeProgress(source, { status: "paused", step: 3 });
    expect(readProgress(source, steps)).toEqual({ status: "paused", step: 3 });
    writeStored(source, tourProgressKey, "done");
    expect(readProgress(source, steps)).toEqual({ status: "done" });
    writeProgress(source, { status: "idle" });
    expect(readProgress(source, steps)).toEqual({ status: "idle" });
  });

  test.each(failingSources)("never throws: %s", (_, source) => {
    expect(writeProgress(source, { status: "active", step: 1 })).toBe(false);
    expect(readProgress(source, steps)).toEqual({ status: "idle" });
  });
});
