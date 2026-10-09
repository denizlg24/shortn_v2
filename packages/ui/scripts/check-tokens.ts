import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  closestPair,
  contrastRatio,
  inSrgbGamut,
  VISIONS,
  type Oklch,
} from "./color-math";

const TEXT_AA = 4.5;
const NON_TEXT_AA = 3;
const MIN_SERIES_DELTA = 0.08;

const source = readFileSync(
  fileURLToPath(new URL("../src/tokens.css", import.meta.url)),
  "utf8",
);

function readBlock(selector: string): Map<string, string> {
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

const light = readBlock(":root");
const dark = new Map([...light, ...readBlock(".dark")]);

function resolve(theme: Map<string, string>, name: string, depth = 0): Oklch {
  const raw = theme.get(name);
  if (!raw) throw new Error(`Unknown token --${name}`);
  const reference = /^var\(--([\w-]+)\)$/.exec(raw);
  if (reference?.[1]) {
    if (depth > 8) throw new Error(`Reference cycle at --${name}`);
    return resolve(theme, reference[1], depth + 1);
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

interface Check {
  fg: string;
  bg: string;
  min: number;
}

const surfaces = ["bg", "bg-subtle", "bg-muted", "field", "overlay"];
const textChecks: Check[] = [
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
const nonTextChecks: Check[] = [
  ...["bg", "bg-subtle", "bg-muted"].map((bg) => ({
    fg: "signal",
    bg,
    min: NON_TEXT_AA,
  })),
  ...[1, 2, 3, 4, 5, 6].map((n) => ({
    fg: `chart-${n}`,
    bg: "bg",
    min: NON_TEXT_AA,
  })),
];

let failures = 0;
const themes = { light, dark } as const;

for (const [themeName, theme] of Object.entries(themes)) {
  console.log(`\n${themeName.toUpperCase()}`);
  for (const [label, checks] of [
    ["text (AA 4.5:1)", textChecks],
    ["non-text (AA 3:1)", nonTextChecks],
  ] as const) {
    console.log(`  ${label}`);
    for (const { fg, bg, min } of checks) {
      const ratio = contrastRatio(resolve(theme, fg), resolve(theme, bg));
      const pass = ratio >= min;
      if (!pass) failures++;
      console.log(
        `    ${pass ? "pass" : "FAIL"}  ${`${fg} on ${bg}`.padEnd(30)} ${ratio.toFixed(2)}:1`,
      );
    }
  }

  const series = [1, 2, 3, 4, 5, 6].map((n) => resolve(theme, `chart-${n}`));
  console.log(
    `  chart series, closest pair in OKLab under simulated vision (min ${MIN_SERIES_DELTA})`,
  );
  for (const vision of VISIONS) {
    const { delta, pair } = closestPair(series, vision);
    const pass = delta >= MIN_SERIES_DELTA;
    if (!pass) failures++;
    console.log(
      `    ${pass ? "pass" : "FAIL"}  ${vision.padEnd(13)} ΔE ${delta.toFixed(3)} (series ${pair[0]}–${pair[1]})`,
    );
  }
  const outOfGamut = series.flatMap((color, i) =>
    inSrgbGamut(color) ? [] : [`chart-${i + 1}`],
  );
  if (outOfGamut.length > 0) {
    failures++;
    console.log(`    FAIL  outside sRGB: ${outOfGamut.join(", ")}`);
  }
}

console.log(
  failures === 0
    ? "\nAll token checks pass."
    : `\n${failures} token check(s) failed.`,
);
process.exit(failures === 0 ? 0 : 1);
