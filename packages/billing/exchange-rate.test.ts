import { expect, test } from "bun:test";
import { fxKeys, loadExchangeRate, parseEcbRate } from "./exchange-rate";

const xml = `<gesmes:Envelope><Cube><Cube time='2026-10-08'><Cube currency='JPY' rate='177.05'/><Cube rate='1.25' currency='USD'/></Cube></Cube></gesmes:Envelope>`;
const now = new Date("2026-10-11T12:00:00Z");
function fixture() {
  let clock = now.getTime();
  const values = new Map<string, { value: string; expires: number }>();
  const cache = {
    async get(key: string) {
      const item = values.get(key);
      return item && item.expires > clock ? item.value : null;
    },
    async set(
      key: string,
      value: string,
      seconds?: number,
      onlyIfMissing?: boolean,
    ) {
      const existing = values.get(key);
      if (onlyIfMissing && existing && existing.expires > clock) return null;
      values.set(key, {
        value,
        expires: seconds ? clock + seconds * 1000 : Infinity,
      });
      return "OK";
    },
  };
  return {
    cache,
    advance: (milliseconds: number) => {
      clock += milliseconds;
    },
  };
}

test("ECB USD-per-EUR quotes are inverted, including reordered attributes", () => {
  expect(parseEcbRate(xml, now)).toEqual({
    eurPerUsd: 0.8,
    asOf: "2026-10-08",
  });
  expect(parseEcbRate(xml.replaceAll("'", '"'), now).eurPerUsd).toBe(0.8);
});

test("invalid, missing and future reference rates are rejected", () => {
  for (const rate of ["0", "-1", "NaN", "Infinity", "1e-999"])
    expect(() => parseEcbRate(xml.replace("1.25", rate), now)).toThrow();
  for (const day of ["2026-02-30", "2027-01-01", "yesterday"])
    expect(() => parseEcbRate(xml.replace("2026-10-08", day), now)).toThrow();
  expect(() => parseEcbRate(xml.replace("USD", "GBP"), now)).toThrow();
});

test("daily rate is cached for 24 hours and retains its source date", async () => {
  const { cache, advance } = fixture();
  let requests = 0;
  const fetcher = async () => {
    requests++;
    return new Response(xml);
  };
  expect(await loadExchangeRate({ cache, fetcher, now })).toEqual({
    eurPerUsd: 0.8,
    asOf: "2026-10-08",
  });
  await loadExchangeRate({ cache, fetcher, now });
  expect(requests).toBe(1);
  advance(86400_001);
  await loadExchangeRate({ cache, fetcher, now });
  expect(requests).toBe(2);
});

test("outages keep the last-known rate and throttle retry attempts", async () => {
  const { cache, advance } = fixture();
  await loadExchangeRate({
    cache,
    fetcher: async () => new Response(xml),
    now,
  });
  advance(86400_001);
  let requests = 0;
  const fetcher = async () => {
    requests++;
    throw new Error("ECB unavailable");
  };
  expect(await loadExchangeRate({ cache, fetcher, now })).toEqual({
    eurPerUsd: 0.8,
    asOf: "2026-10-08",
  });
  expect(await loadExchangeRate({ cache, fetcher, now })).toEqual({
    eurPerUsd: 0.8,
    asOf: "2026-10-08",
  });
  expect(requests).toBe(1);
  expect(await cache.get(fxKeys.last)).not.toBeNull();
});

test("a cold outage or malformed response never invents an estimate", async () => {
  for (const response of [
    new Response("unavailable", { status: 503 }),
    new Response("<Cube/>"),
  ]) {
    const { cache } = fixture();
    expect(
      await loadExchangeRate({ cache, fetcher: async () => response, now }),
    ).toBeNull();
  }
});

test("corrupt cached values are replaced from the validated feed", async () => {
  const { cache } = fixture();
  await cache.set(
    fxKeys.current,
    JSON.stringify({ eurPerUsd: -1, asOf: "2026-10-08" }),
  );
  expect(
    (
      await loadExchangeRate({
        cache,
        fetcher: async () => new Response(xml),
        now,
      })
    )?.eurPerUsd,
  ).toBe(0.8);
});

test("a simultaneous cold request does not start a second ECB fetch", async () => {
  const { cache } = fixture();
  const started = Promise.withResolvers<void>();
  const release = Promise.withResolvers<Response>();
  let requests = 0;
  const fetcher = async () => {
    requests++;
    started.resolve();
    return release.promise;
  };
  const first = loadExchangeRate({ cache, fetcher, now });
  await started.promise;
  expect(await loadExchangeRate({ cache, fetcher, now })).toBeNull();
  release.resolve(new Response(xml));
  expect((await first)?.eurPerUsd).toBe(0.8);
  expect((await loadExchangeRate({ cache, fetcher, now }))?.eurPerUsd).toBe(
    0.8,
  );
  expect(requests).toBe(1);
});
