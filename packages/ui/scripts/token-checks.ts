import {
  closestPair,
  contrastRatio,
  inSrgbGamut,
  VISIONS,
  type Oklch,
} from "./color-math";

export const TEXT_AA = 4.5;
export const NON_TEXT_AA = 3;
export const MIN_SERIES_DELTA = 0.08;

export type ThemeName = "light" | "dark";
export type CheckSection = "text" | "non-text" | "series" | "gamut";

export interface TokenCheckResult {
  theme: ThemeName;
  section: CheckSection;
  name: string;
  pass: boolean;
  detail: string;
}

type Tokens = Map<string, string>;

const THEMES: ThemeName[] = ["light", "dark"];
const CHART_SERIES = [1, 2, 3, 4, 5, 6];

function readBlock(source: string, selector: string): Tokens {
  const escaped = selector.replace(".", "\\.");
  const match = new RegExp(`(?:^|\\n)${escaped}\\s*\\{([^}]*)\\}`).exec(source);
  if (!match?.[1])
    throw new Error(`No top-level ${selector} block in tokens.css`);
  const declarations = new Map<string, string>();
  for (const [, name, value] of match[1].matchAll(/--([\w-]+):\s*([^;]+);/g)) {
    if (name && value) declarations.set(name, value.trim());
  }
  return declarations;
}

function readThemes(source: string): Record<ThemeName, Tokens> {
  const light = readBlock(source, ":root");
  return { light, dark: new Map([...light, ...readBlock(source, ".dark")]) };
}

function resolve(tokens: Tokens, name: string, depth = 0): Oklch {
  const raw = tokens.get(name);
  if (!raw) throw new Error(`Unknown token --${name}`);
  const reference = /^var\(--([\w-]+)\)$/.exec(raw);
  if (reference?.[1]) {
    if (depth > 8) throw new Error(`Reference cycle at --${name}`);
    return resolve(tokens, reference[1], depth + 1);
  }
  const color =
    /^oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.]+)(%?))?\s*\)$/.exec(
      raw,
    );
  if (!color) throw new Error(`--${name} is not an oklch() colour: ${raw}`);
  const alphaRaw = color[4] === undefined ? 1 : Number(color[4]);
  return {
    l: Number(color[1]),
    c: Number(color[2]),
    h: Number(color[3]),
    alpha: color[5] === "%" ? alphaRaw / 100 : alphaRaw,
  };
}

interface ContrastPair {
  fg: string;
  bg: string;
  min: number;
}

const surfaces = ["bg", "bg-subtle", "bg-muted", "field", "overlay"];
const textPairs: ContrastPair[] = [
  ...["fg", "fg-muted", "fg-subtle"].flatMap((fg) =>
    surfaces.map((bg) => ({ fg, bg, min: TEXT_AA })),
  ),
  { fg: "primary-fg", bg: "primary", min: TEXT_AA },
  { fg: "primary-fg", bg: "primary-hover", min: TEXT_AA },
  { fg: "signal", bg: "bg", min: TEXT_AA },
  { fg: "signal-fg", bg: "signal", min: TEXT_AA },
  { fg: "danger", bg: "bg", min: TEXT_AA },
  { fg: "danger", bg: "overlay", min: TEXT_AA },
  { fg: "danger-fg", bg: "danger", min: TEXT_AA },
  { fg: "success", bg: "bg", min: TEXT_AA },
  { fg: "warning", bg: "bg", min: TEXT_AA },
  { fg: "tooltip-fg", bg: "tooltip-bg", min: TEXT_AA },
];
const nonTextPairs: ContrastPair[] = [
  ...["bg", "bg-subtle", "bg-muted"].map((bg) => ({
    fg: "signal",
    bg,
    min: NON_TEXT_AA,
  })),
  ...CHART_SERIES.map((n) => ({
    fg: `chart-${n}`,
    bg: "bg",
    min: NON_TEXT_AA,
  })),
];

/** Text/non-text contrast, chart-series separation under simulated colour vision, and sRGB gamut, per theme. */
export function runTokenChecks(source: string): TokenCheckResult[] {
  const themes = readThemes(source);
  const results: TokenCheckResult[] = [];

  for (const theme of THEMES) {
    const tokens = themes[theme];
    for (const [section, pairs] of [
      ["text", textPairs],
      ["non-text", nonTextPairs],
    ] as const) {
      for (const { fg, bg, min } of pairs) {
        const ratio = contrastRatio(resolve(tokens, fg), resolve(tokens, bg));
        results.push({
          theme,
          section,
          name: `${fg} on ${bg}`,
          pass: ratio >= min,
          detail: `${ratio.toFixed(2)}:1`,
        });
      }
    }

    const series = CHART_SERIES.map((n) => resolve(tokens, `chart-${n}`));
    for (const vision of VISIONS) {
      const { delta, pair } = closestPair(series, vision);
      results.push({
        theme,
        section: "series",
        name: vision,
        pass: delta >= MIN_SERIES_DELTA,
        detail: `ΔE ${delta.toFixed(3)} (series ${pair[0]}–${pair[1]})`,
      });
    }

    const outOfGamut = series.flatMap((color, i) =>
      inSrgbGamut(color) ? [] : [`chart-${i + 1}`],
    );
    results.push({
      theme,
      section: "gamut",
      name: "chart series",
      pass: outOfGamut.length === 0,
      detail:
        outOfGamut.length === 0
          ? "inside sRGB"
          : `outside sRGB: ${outOfGamut.join(", ")}`,
    });
  }

  return results;
}
