import { describe, expect, test } from "bun:test";
import { createdBounds, normalizeCreated, utcDay } from "./created-range";

const now = new Date("2026-10-11T16:45:00Z");
const query = (value: string) => new URLSearchParams(value);

describe("created date ranges", () => {
  test("includes the entire last date using an exclusive next-day bound", () => {
    const bounds = createdBounds(
      query("created=custom&from=2026-10-01&to=2026-10-02"),
      now,
    );
    expect(bounds.createdAfter?.toISOString()).toBe("2026-10-01T00:00:00.000Z");
    expect(bounds.createdBefore?.toISOString()).toBe(
      "2026-10-03T00:00:00.000Z",
    );
    expect(new Date("2026-10-02T23:59:59.999Z") < bounds.createdBefore!).toBe(
      true,
    );
    expect(new Date("2026-10-03T00:00:00.000Z") < bounds.createdBefore!).toBe(
      false,
    );
  });
  test("supports one-sided and reversed ranges", () => {
    expect(createdBounds(query("created=custom&from=2026-10-01"), now)).toEqual(
      { createdAfter: new Date("2026-10-01T00:00:00Z") },
    );
    expect(createdBounds(query("created=custom&to=2026-10-01"), now)).toEqual({
      createdBefore: new Date("2026-10-02T00:00:00Z"),
    });
    expect(
      createdBounds(query("created=custom&from=2026-10-02&to=2026-10-01"), now),
    ).toEqual(
      createdBounds(query("created=custom&from=2026-10-01&to=2026-10-02"), now),
    );
  });
  test("rejects overflow dates, invalid dates and stale dates outside Custom", () => {
    for (const value of [
      "2026-02-29",
      "2026-13-01",
      "2026-10-32",
      "01/10/2026",
      null,
    ])
      expect(utcDay(value)).toBeNull();
    expect(utcDay("2024-02-29")?.toISOString()).toBe(
      "2024-02-29T00:00:00.000Z",
    );
    expect(createdBounds(query("from=2026-10-01&to=2026-10-02"), now)).toEqual(
      {},
    );
    expect(createdBounds(query("created=7&from=2020-01-01"), now)).toEqual({
      createdAfter: new Date("2026-10-04T16:45:00Z"),
    });
  });
  test("selecting Custom seeds dates while keeping tags, search, sort and view", () => {
    const next = normalizeCreated(
      query(
        "created=custom&tag=Print&tag=Editorial&q=report&sort=clicks&view=list&page=4",
      ),
      query("created=7"),
      now,
    );
    expect(next.getAll("tag")).toEqual(["Print", "Editorial"]);
    expect(next.get("from")).toBe("2026-09-12");
    expect(next.get("to")).toBe("2026-10-11");
    expect(next.get("q")).toBe("report");
    expect(next.get("sort")).toBe("clicks");
    expect(next.get("view")).toBe("list");
    expect(next.has("page")).toBe(false);
  });
  test("leaving Custom drops dates; clearing a bound does not restore it", () => {
    const next = normalizeCreated(
      query("created=30&from=2020-01-01&to=2020-01-02"),
      query("created=custom"),
      now,
    );
    expect(next.has("from")).toBe(false);
    expect(next.has("to")).toBe(false);
    expect(
      normalizeCreated(
        query("created=custom"),
        query("created=custom"),
        now,
      ).has("from"),
    ).toBe(false);
  });
});
