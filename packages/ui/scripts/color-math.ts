export interface Oklch {
  l: number;
  c: number;
  h: number;
  alpha: number;
}

type Vec3 = [number, number, number];

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

function oklchToOklab({ l, c, h }: Oklch): Vec3 {
  const rad = (h * Math.PI) / 180;
  return [l, c * Math.cos(rad), c * Math.sin(rad)];
}

function oklabToLinearSrgb([L, a, b]: Vec3): Vec3 {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

function linearSrgbToOklab([r, g, b]: Vec3): Vec3 {
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

const isInGamut = (v: Vec3) => v.every((x) => x >= -1e-4 && x <= 1 + 1e-4);

export function inSrgbGamut(color: Oklch): boolean {
  return isInGamut(oklabToLinearSrgb(oklchToOklab(color)));
}

/** Gamut-maps by chroma reduction, as CSS Color 4 does for sRGB displays. */
export function toLinearSrgb(color: Oklch): Vec3 {
  const direct = oklabToLinearSrgb(oklchToOklab(color));
  if (isInGamut(direct)) return direct.map(clamp01) as Vec3;
  let lo = 0;
  let hi = color.c;
  for (let i = 0; i < 32; i++) {
    const mid = (lo + hi) / 2;
    if (isInGamut(oklabToLinearSrgb(oklchToOklab({ ...color, c: mid }))))
      lo = mid;
    else hi = mid;
  }
  return oklabToLinearSrgb(oklchToOklab({ ...color, c: lo })).map(
    clamp01,
  ) as Vec3;
}

const encode = (x: number) =>
  x <= 0.0031308 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - 0.055;
const decode = (x: number) =>
  x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;

function flatten(top: Oklch, under: Oklch): Vec3 {
  const t = toLinearSrgb(top);
  const u = toLinearSrgb(under);
  return [0, 1, 2].map((i) =>
    decode(encode(t[i] ?? 0) * top.alpha + encode(u[i] ?? 0) * (1 - top.alpha)),
  ) as Vec3;
}

const luminance = ([r, g, b]: Vec3) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

export function contrastRatio(fg: Oklch, bg: Oklch): number {
  const f = luminance(fg.alpha < 1 ? flatten(fg, bg) : toLinearSrgb(fg));
  const b = luminance(toLinearSrgb(bg));
  const [hi, lo] = f > b ? [f, b] : [b, f];
  return (hi + 0.05) / (lo + 0.05);
}

/** Machado, Oliveira & Fernandes (2009), severity 1.0, applied in linear sRGB. */
const CVD_MATRICES = {
  protanopia: [
    [0.152286, 1.052583, -0.204868],
    [0.114503, 0.786281, 0.099216],
    [-0.003882, -0.048116, 1.051998],
  ],
  deuteranopia: [
    [0.367322, 0.860646, -0.227968],
    [0.280085, 0.672501, 0.047413],
    [-0.01182, 0.04294, 0.968881],
  ],
  tritanopia: [
    [1.255528, -0.076749, -0.178779],
    [-0.078411, 0.930809, 0.147602],
    [0.004733, 0.691367, 0.3039],
  ],
} as const;

export type Vision = "normal" | keyof typeof CVD_MATRICES;
export const VISIONS: Vision[] = [
  "normal",
  "protanopia",
  "deuteranopia",
  "tritanopia",
];

function simulate(lin: Vec3, vision: Vision): Vec3 {
  if (vision === "normal") return lin;
  const m = CVD_MATRICES[vision];
  return m.map((row) =>
    clamp01(row[0] * lin[0] + row[1] * lin[1] + row[2] * lin[2]),
  ) as Vec3;
}

export function closestPair(
  colors: Oklch[],
  vision: Vision,
): { delta: number; pair: [number, number] } {
  const labs = colors.map((c) =>
    linearSrgbToOklab(simulate(toLinearSrgb(c), vision)),
  );
  let best = {
    delta: Number.POSITIVE_INFINITY,
    pair: [0, 0] as [number, number],
  };
  labs.forEach((a, i) => {
    labs.slice(i + 1).forEach((b, offset) => {
      const delta = Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
      if (delta < best.delta) best = { delta, pair: [i + 1, i + offset + 2] };
    });
  });
  return best;
}
