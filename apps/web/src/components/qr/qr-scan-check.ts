import type { ErrorLevel } from "./qr-draft";

export interface Rgba {
  r: number;
  g: number;
  b: number;
  /** 0–1 */
  a: number;
}

const named: Record<string, Rgba> = {
  black: { r: 0, g: 0, b: 0, a: 1 },
  white: { r: 255, g: 255, b: 255, a: 1 },
  transparent: { r: 0, g: 0, b: 0, a: 0 },
};

const hexPattern = /^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const rgbPattern =
  /^rgba?\(\s*([\d.]+%?)\s*[, ]\s*([\d.]+%?)\s*[, ]\s*([\d.]+%?)\s*(?:[,/]\s*([\d.]+%?)\s*)?\)$/i;

const channel = (raw: string, max: number) => {
  const value = raw.endsWith("%")
    ? (Number.parseFloat(raw) / 100) * max
    : Number.parseFloat(raw);
  return Math.min(max, Math.max(0, value));
};

/** Hex, rgb()/rgba() and the few names the editor writes; else null. */
export function parseColor(input: string): Rgba | null {
  const value = input.trim().toLowerCase();
  const known = named[value];
  if (known) return known;
  const hex = hexPattern.exec(value)?.[1];
  if (hex) {
    const digits =
      hex.length <= 4
        ? [...hex].map((digit) => digit + digit)
        : hex.match(/../g);
    if (!digits) return null;
    const [r = 0, g = 0, b = 0, a = 255] = digits.map((pair) =>
      Number.parseInt(pair, 16),
    );
    return { r, g, b, a: a / 255 };
  }
  const rgb = rgbPattern.exec(value);
  if (rgb) {
    const [, r = "0", g = "0", b = "0", a] = rgb;
    return {
      r: channel(r, 255),
      g: channel(g, 255),
      b: channel(b, 255),
      a: a === undefined ? 1 : channel(a, 1),
    };
  }
  return null;
}

const linear = (value: number) => {
  const c = value / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};

/** WCAG relative luminance, which tracks a print's reflectance closely. */
export const luminance = ({ r, g, b }: Rgba) =>
  0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);

const over = (top: Rgba, bottom: Rgba): Rgba => ({
  r: top.r * top.a + bottom.r * (1 - top.a),
  g: top.g * top.a + bottom.g * (1 - top.a),
  b: top.b * top.a + bottom.b * (1 - top.a),
  a: 1,
});

const white = named.white ?? { r: 255, g: 255, b: 255, a: 1 };

export type ContrastTone = "ok" | "warning" | "danger";

// ISO/IEC 18004 grades print contrast as the reflectance difference between
// light and dark modules: 70% and up is grade A, 40% grade C, 20% the
// floor. Phone cameras in poor light need margin above the floor.
export const contrastTone = (difference: number): ContrastTone =>
  difference >= 0.55 ? "ok" : difference >= 0.4 ? "warning" : "danger";

export type ScanIssue =
  | { kind: "contrast"; tone: ContrastTone; difference: number }
  | { kind: "unknownColor" }
  | { kind: "inverted" }
  | { kind: "transparent" }
  | { kind: "logoLarge"; share: number }
  | { kind: "logoSmall" }
  | { kind: "logoUnavailable" };

export interface ScanInput {
  foreground: string;
  background: string;
  /** Corner colours that differ from the code colour. */
  corners: string[];
  logo: boolean;
  logoSize: number;
  errorLevel: ErrorLevel;
  logoUnavailable: boolean;
}

/**
 * What could stop a phone reading the code, worst first. The logo hides
 * `logoSize` of the error-correction budget (qr-code-styling sizes it as
 * imageSize × the level's capacity), so above half there's little left for
 * scuffs and glare.
 */
export function scanIssues(input: ScanInput): ScanIssue[] {
  const issues: ScanIssue[] = [];
  const background = parseColor(input.background);
  const darks = [input.foreground, ...input.corners].map(parseColor);
  if (!background || darks.some((color) => color === null)) {
    issues.push({ kind: "unknownColor" });
  } else {
    const surface = background.a < 1 ? over(background, white) : background;
    const light = luminance(surface);
    const levels = darks.flatMap((color) =>
      color ? [luminance(over(color, surface))] : [],
    );
    const difference = Math.min(
      ...levels.map((dark) => Math.abs(light - dark)),
    );
    issues.push({
      kind: "contrast",
      tone: contrastTone(difference),
      difference,
    });
    if (levels.some((dark) => dark > light)) issues.push({ kind: "inverted" });
    if (background.a < 1) issues.push({ kind: "transparent" });
  }
  if (input.logo) {
    if (input.logoUnavailable) issues.push({ kind: "logoUnavailable" });
    else if (input.logoSize > 0.5)
      issues.push({ kind: "logoLarge", share: input.logoSize });
    else if (input.errorLevel === "L" || input.errorLevel === "M")
      issues.push({ kind: "logoSmall" });
  }
  const rank = (issue: ScanIssue) =>
    issue.kind === "contrast"
      ? issue.tone === "danger"
        ? 0
        : issue.tone === "warning"
          ? 1
          : 9
      : 2;
  return issues.sort((a, b) => rank(a) - rank(b));
}
