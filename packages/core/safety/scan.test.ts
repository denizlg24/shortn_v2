import { describe, expect, spyOn, test } from "bun:test";
import { safetyCacheScripts, type SafetyCache } from "./cache";
import { scanUrl, type ScanDeps } from "./scan";

function fixture() {
  const entries = new Map<string, string>();
  const cache: SafetyCache = {
    async eval(script, _count, key, value) {
      if (script === safetyCacheScripts.read)
        return entries.get(String(key)) ?? null;
      if (script !== safetyCacheScripts.write)
        throw new Error("Unexpected script");
      entries.set(String(key), String(value));
      return "OK";
    },
  };
  const calls: string[] = [];
  let webRisk: unknown = {},
    rdap: unknown = {
      events: [
        {
          eventAction: "registration",
          eventDate: new Date(Date.now() - 90 * 86400000).toISOString(),
        },
      ],
    },
    status = 200;
  const deps: ScanDeps = {
    cache,
    webRiskApiKey: "synthetic-provider-secret",
    fetch: async (input) => {
      calls.push(input);
      return Response.json(
        new URL(input).hostname === "rdap.org" ? rdap : webRisk,
        { status },
      );
    },
  };
  return {
    cache,
    entries,
    calls,
    deps,
    threat: (expiry: number) => {
      webRisk = {
        threat: {
          threatTypes: ["MALWARE"],
          expireTime: new Date(expiry).toISOString(),
        },
      };
    },
    registration: (time: number) => {
      rdap = {
        events: [
          {
            eventAction: "registration",
            eventDate: new Date(time).toISOString(),
          },
        ],
      };
    },
    status: (next: number) => {
      status = next;
    },
  };
}

describe("destination safety provider cache", () => {
  test("shares registration by host while checking every distinct URL and every clean result", async () => {
    const f = fixture();
    for (const url of [
      "https://example.com/clean",
      "https://example.com/other",
      "https://example.com/clean",
    ])
      expect((await scanUrl(url, f.deps)).safetyStatus).toBe("safe");
    expect(
      f.calls.filter((url) => new URL(url).hostname === "rdap.org"),
    ).toHaveLength(1);
    expect(
      f.calls.filter(
        (url) => new URL(url).hostname === "webrisk.googleapis.com",
      ),
    ).toHaveLength(3);
    f.threat(Date.now() + 60000);
    expect(
      (await scanUrl("https://example.com/malware", f.deps)).disabled,
    ).toBe(true);
    expect(
      (
        await scanUrl("https://example.com/clean", {
          ...f.deps,
          fetch: async (input) => {
            if (new URL(input).hostname === "rdap.org")
              throw new Error("Registration should be cached");
            return Response.json({});
          },
        })
      ).disabled,
    ).toBe(false);
    expect([...f.entries.keys()].join()).not.toContain("example.com");
    expect([...f.entries.keys()].join()).not.toContain(
      "synthetic-provider-secret",
    );
    expect([...f.entries.values()].join()).not.toContain("https://example.com");
  });

  test("unsafe matches survive a new cache client until exact expiry; key rotation and paths are isolated", async () => {
    const f = fixture(),
      now = Date.now(),
      expiry = now + 60000;
    f.threat(expiry);
    const url = "https://example.com/malware";
    expect((await scanUrl(url, f.deps)).riskScore).toBe(100);
    const otherClient: SafetyCache = { eval: f.cache.eval.bind(f.cache) };
    expect(
      (await scanUrl(url, { ...f.deps, cache: otherClient })).riskScore,
    ).toBe(100);
    expect(f.calls).toHaveLength(2);
    expect(
      (await scanUrl(url, { ...f.deps, webRiskApiKey: "rotated-secret" }))
        .disabled,
    ).toBe(true);
    expect(f.calls).toHaveLength(3);
    const clock = spyOn(Date, "now").mockReturnValue(expiry);
    try {
      expect((await scanUrl(url, f.deps)).riskScore).toBe(100);
      expect(f.calls).toHaveLength(4);
      // An already-expired provider match is still applied to this scan but
      // never reused as if the expiry had been extended.
      await scanUrl(url, f.deps);
      expect(f.calls).toHaveLength(5);
    } finally {
      clock.mockRestore();
    }
  });

  test("registration age advances through the 30-day boundary and refreshes after 24 hours", async () => {
    const f = fixture(),
      now = Date.now();
    const clock = spyOn(Date, "now").mockReturnValue(now);
    try {
      f.registration(now - 29.5 * 86400000);
      expect((await scanUrl("https://example.com", f.deps)).riskScore).toBe(25);
      clock.mockReturnValue(now + 0.75 * 86400000);
      expect((await scanUrl("https://example.com", f.deps)).riskScore).toBe(0);
      expect(f.calls.filter((url) => url.includes("rdap.org"))).toHaveLength(1);
      clock.mockReturnValue(now + 86400001);
      await scanUrl("https://example.com", f.deps);
      expect(f.calls.filter((url) => url.includes("rdap.org"))).toHaveLength(2);
    } finally {
      clock.mockRestore();
    }
  });

  test("provider outages are not cached and cache outages cannot suppress provider threats", async () => {
    const f = fixture();
    f.status(503);
    for (let n = 0; n < 2; n++)
      expect(
        (await scanUrl("https://example.com", f.deps)).reputationUnavailable,
      ).toBe(true);
    expect(f.calls).toHaveLength(4);
    expect(f.entries.size).toBe(0);
    f.status(200);
    f.threat(Date.now() + 60000);
    const unavailable: SafetyCache = {
      async eval() {
        throw new Error("cache unavailable");
      },
    };
    const result = await scanUrl("https://example.com", {
      ...f.deps,
      cache: unavailable,
    });
    expect(result.disabled).toBe(true);
    expect(result.reputationUnavailable).toBeUndefined();
  });

  test("corrupt entries and structural signals are checked independently of cached metadata", async () => {
    const f = fixture();
    await scanUrl("https://example.com", f.deps);
    for (const key of f.entries.keys()) f.entries.set(key, "{invalid");
    expect(
      (await scanUrl("https://example.com/file.zip", f.deps)).riskScore,
    ).toBe(15);
    expect(f.calls.filter((url) => url.includes("rdap.org"))).toHaveLength(2);
    const before = f.calls.length;
    expect((await scanUrl("http://127.0.0.1/private", f.deps)).disabled).toBe(
      true,
    );
    expect(f.calls).toHaveLength(before);
  });

  test("coalesces concurrent provider requests without retaining failed or finished promises", async () => {
    const f = fixture();
    const outcomes = await Promise.all(
      Array.from({ length: 20 }, () => scanUrl("https://example.com", f.deps)),
    );
    expect(outcomes.every((outcome) => outcome.safetyStatus === "safe")).toBe(
      true,
    );
    expect(f.calls).toHaveLength(2);
    await scanUrl("https://example.com", f.deps);
    expect(f.calls).toHaveLength(3);
  });
});
