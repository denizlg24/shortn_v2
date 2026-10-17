import { treatmentLayout } from "./treatment-layout";
import Color from "colorjs.io";
import { qrMatrix, type ErrorCorrection } from "./matrix";

type Stored = Record<string, unknown>;
export const record = (value: unknown): Stored =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Stored)
    : {};
const numeric = (value: unknown, fallback: number) => {
  if (typeof value !== "number" && typeof value !== "string") return fallback;
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

export class QrPrintError extends Error {
  constructor(
    public readonly code:
      | "invalid_data"
      | "invalid_size"
      | "invalid_color"
      | "low_contrast"
      | "invalid_design"
      | "logo_unavailable",
  ) {
    super(code);
  }
}

/** Canonical, opaque sRGB CSS. SVG attributes never receive stored CSS text. */
export function printColor(value: unknown, fallback: string): string {
  try {
    if (typeof value !== "string" || value.length > 128) throw new Error();
    const parsed = new Color(value).to("srgb");
    if (
      parsed.alpha !== 1 ||
      parsed.coords.some(
        (coordinate) => coordinate === null || !Number.isFinite(coordinate),
      )
    )
      throw new Error();
    return parsed.toString({ format: "hex" });
  } catch {
    if (value === undefined) return fallback;
    throw new QrPrintError("invalid_color");
  }
}

function colors(part: Stored, fallback: string): string[] {
  const gradient = record(part.gradient);
  if (part.gradient === undefined) return [printColor(part.color, fallback)];
  if (
    !["linear", "radial"].includes(String(gradient.type)) ||
    !Array.isArray(gradient.colorStops) ||
    gradient.colorStops.length < 2 ||
    gradient.colorStops.length > 16
  )
    throw new QrPrintError("invalid_design");
  let previous = -1;
  return gradient.colorStops.map((value: unknown) => {
    const stop = record(value),
      offset = Number(stop.offset);
    if (
      !Number.isFinite(offset) ||
      offset < 0 ||
      offset > 1 ||
      offset < previous
    )
      throw new QrPrintError("invalid_design");
    previous = offset;
    return printColor(stop.color, fallback);
  });
}

// sRGB interpolation has convex channel luminance. Sample each segment and
// include a conservative luminance error bound so gradients near 3:1 fail.
function luminanceRange(values: string[]) {
  const parsed = values.map((value) => new Color(value));
  const luminances = parsed.map((color) => color.luminance);
  for (let index = 1; index < parsed.length; index++) {
    const before = parsed[index - 1]!,
      after = parsed[index]!;
    for (let step = 1; step < 256; step++) {
      luminances.push(
        before.mix(after, step / 256, { space: "srgb" }).luminance,
      );
    }
  }
  const pad = parsed.length > 1 ? 0.0001 : 0;
  return {
    min: Math.max(0, Math.min(...luminances) - pad),
    max: Math.min(1, Math.max(...luminances) + pad),
  };
}

export function planQrPrint(stored: Stored, fallbackData: string, size = 1024) {
  if (!Number.isInteger(size) || size < 128 || size > 4096)
    throw new QrPrintError("invalid_size");
  const data =
    typeof stored.data === "string" && stored.data ? stored.data : fallbackData;
  if (!data || data.length > 2048) throw new QrPrintError("invalid_data");
  const image =
    typeof stored.image === "string" && stored.image ? stored.image : undefined;
  const requestedCorrection = record(stored.qrOptions).errorCorrectionLevel;
  const correction: ErrorCorrection = image
    ? "H"
    : requestedCorrection === "H"
      ? "H"
      : "Q";
  let matrix;
  try {
    matrix = qrMatrix(data, correction);
  } catch {
    throw new QrPrintError("invalid_data");
  }
  const background = colors(record(stored.backgroundOptions), "#ffffff");
  const dots = colors(record(stored.dotsOptions), "#000000");
  const foreground = [
    ...dots,
    ...colors(record(stored.cornersSquareOptions), dots[0]!),
    ...colors(record(stored.cornersDotOptions), dots[0]!),
  ];
  const light = luminanceRange(background),
    dark = luminanceRange(foreground);
  // Do not invent a contrast from endpoints whose luminance ranges overlap.
  const contrast =
    dark.max < light.min
      ? (light.min + 0.05) / (dark.max + 0.05)
      : light.max < dark.min
        ? (dark.min + 0.05) / (light.max + 0.05)
        : 1;
  if (contrast < 3) throw new QrPrintError("low_contrast");
  const baseWidth = numeric(stored.width, 300);
  const storedMargin = numeric(stored.margin, 0);
  if (baseWidth <= 0 || storedMargin < 0 || storedMargin > baseWidth / 2)
    throw new QrPrintError("invalid_design");
  let layout;
  try {
    layout = treatmentLayout(stored, size);
  } catch {
    throw new QrPrintError("invalid_design");
  }
  const coreSize = layout.coreSize;
  const margin = Math.max(
    Math.ceil((coreSize * storedMargin) / baseWidth),
    Math.ceil((coreSize * 4) / (matrix.size + 8)),
  );
  const round = record(stored.dotsOptions).roundSize !== false;
  const moduleSize = round
    ? Math.floor((coreSize - margin * 2) / matrix.size)
    : (coreSize - margin * 2) / matrix.size;
  if (moduleSize < 1) throw new QrPrintError("invalid_size");
  const inset = round
    ? Math.floor((coreSize - moduleSize * matrix.size) / 2)
    : margin;
  return {
    data,
    size,
    coreSize,
    correction,
    matrix,
    contrast,
    margin: inset,
    moduleSize,
    quietZoneModules: inset / moduleSize,
    // Four printer pixels per module at 300 dpi, including the quiet zone.
    minimumPrintMm:
      Math.ceil(
        (((((matrix.size + 8) * size) / coreSize) * 4) / 300) * 25.4 * 10,
      ) / 10,
    ...(image ? { image } : {}),
  };
}
