import type { BarListItem, LinkRow, TimeSeriesPoint } from "@shortn/ui";
import { createRandom, hashString } from "./random";

const DAY = 86_400_000;

const COUNTRY_WEIGHTS: ReadonlyArray<readonly [code: string, weight: number]> =
  [
    ["PT", 0.62],
    ["BR", 0.11],
    ["ES", 0.06],
    ["FR", 0.05],
    ["AO", 0.04],
    ["GB", 0.035],
    ["CH", 0.03],
    ["MZ", 0.02],
    ["LU", 0.015],
  ];

const REFERRERS_BY_TAG: Record<
  string,
  ReadonlyArray<readonly [label: string, weight: number]>
> = {
  newsletter: [
    ["Email", 0.71],
    ["Direct", 0.14],
    ["google.com", 0.08],
    ["linkedin.com", 0.04],
  ],
  linkedin: [
    ["linkedin.com", 0.68],
    ["Direct", 0.16],
    ["google.com", 0.09],
    ["x.com", 0.03],
  ],
  print: [
    ["QR scan", 0.86],
    ["Direct", 0.11],
    ["google.com", 0.03],
  ],
  facebook: [
    ["facebook.com", 0.64],
    ["instagram.com", 0.12],
    ["Direct", 0.15],
    ["google.com", 0.06],
  ],
};

const DEFAULT_REFERRERS: ReadonlyArray<readonly [string, number]> = [
  ["Direct", 0.4],
  ["google.com", 0.24],
  ["linkedin.com", 0.14],
  ["facebook.com", 0.1],
  ["x.com", 0.05],
];

function distribute(
  total: number,
  weights: ReadonlyArray<readonly [string, number]>,
  seed: number,
): Array<[string, number]> {
  const random = createRandom(seed);
  const jittered = weights.map(
    ([label, weight]) => [label, weight * (0.8 + random.next() * 0.4)] as const,
  );
  const sum = jittered.reduce((acc, [, weight]) => acc + weight, 0);
  return jittered
    .map(([label, weight]): [string, number] => [
      label,
      Math.round((weight / sum) * total),
    ])
    .filter(([, value]) => value > 0)
    .sort((a, b) => b[1] - a[1]);
}

export interface ActivityEntry {
  id: string;
  actor: string;
  kind: "created" | "destination" | "tag" | "qr" | "export";
  at: string;
  detail?: string;
}

export interface LinkDetails {
  series: TimeSeriesPoint[];
  last30: number;
  previous30: number;
  countries: BarListItem[];
  referrers: BarListItem[];
  activity: ActivityEntry[];
}

export function getLinkDetails(
  link: LinkRow,
  intlLocale: string,
  referrerLabels: Record<string, string>,
): LinkDetails {
  const seed = hashString(link.id);
  const random = createRandom(seed);
  const today = Date.now();
  const series = link.trend.map((value, index) => ({
    date: new Date(today - (link.trend.length - 1 - index) * DAY)
      .toISOString()
      .slice(0, 10),
    value,
  }));
  const last30 = link.trend.reduce((sum, value) => sum + value, 0);
  const ageDays = (today - Date.parse(link.createdAt)) / DAY;
  const previous30 =
    ageDays < 30 ? 0 : Math.round(last30 * (0.6 + random.next() * 0.8));

  const regionNames = new Intl.DisplayNames([intlLocale], { type: "region" });
  const countries = distribute(last30, COUNTRY_WEIGHTS, seed + 1)
    .slice(0, 5)
    .map(([code, value]) => ({
      id: code,
      label: regionNames.of(code) ?? code,
      value,
    }));

  const referrerWeights =
    link.tags.map((tag) => REFERRERS_BY_TAG[tag]).find(Boolean) ??
    DEFAULT_REFERRERS;
  const referrers = distribute(last30, referrerWeights, seed + 2)
    .slice(0, 5)
    .map(([label, value]) => ({
      id: label,
      label: referrerLabels[label] ?? label,
      value,
    }));

  const created = Date.parse(link.createdAt);
  const activity: ActivityEntry[] = [
    {
      id: "created",
      actor: link.createdBy ?? "API",
      kind: "created",
      at: link.createdAt,
    },
  ];
  if (ageDays > 3 && random.chance(0.6)) {
    activity.push({
      id: "tag",
      actor: link.createdBy ?? "API",
      kind: "tag",
      at: new Date(
        created + random.next() * Math.min(ageDays, 20) * DAY,
      ).toISOString(),
      detail: link.tags.at(-1) ?? "newsletter",
    });
  }
  if (ageDays > 10 && random.chance(0.4)) {
    activity.push({
      id: "destination",
      actor: "Rui Carvalho",
      kind: "destination",
      at: new Date(
        created + (0.3 + random.next() * 0.6) * ageDays * DAY,
      ).toISOString(),
    });
  }
  if (link.tags.includes("print")) {
    activity.push({
      id: "qr",
      actor: link.createdBy ?? "API",
      kind: "qr",
      at: new Date(created + 2 * 3_600_000).toISOString(),
    });
  }
  activity.sort((a, b) => Date.parse(b.at) - Date.parse(a.at));

  return { series, last30, previous30, countries, referrers, activity };
}
