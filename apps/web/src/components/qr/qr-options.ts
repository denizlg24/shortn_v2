import type { QrDesign } from "@shortn/core";
import type {
  CornerDotType,
  CornerSquareType,
  DotType,
  ErrorCorrectionLevel,
  Gradient,
  GradientType,
  Options,
  ShapeType,
} from "qr-code-styling";
import { cornerStyles, dotStyles, errorLevels } from "./qr-draft";

// Plain functions, shared by server pages and the client editor: the
// stored qr-code-styling options (QrView.storedDesign) are what was
// printed, legacy gradients and all.

export type PrintedQrOptions = Options & {
  frameOptions?: QrDesign["frameOptions"];
};
type Stored = Record<string, unknown>;

const isRecord = (value: unknown): value is Stored =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const text = (value: unknown) =>
  typeof value === "string" && value !== "" ? value : undefined;

// Legacy stored some sizes as strings.
const number = (value: unknown) => {
  if (typeof value === "number")
    return Number.isFinite(value) ? value : undefined;
  if (typeof value !== "string" || value.trim() === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const flag = (value: unknown) =>
  typeof value === "boolean" ? value : undefined;

const oneOf = <T extends string>(options: readonly T[], value: unknown) =>
  options.find((option) => option === value);

const dotTypes: readonly DotType[] = dotStyles;
const cornerSquareTypes: readonly CornerSquareType[] = cornerStyles;
const cornerDotTypes: readonly CornerDotType[] = cornerStyles;
const levels: readonly ErrorCorrectionLevel[] = errorLevels;
const gradientTypes: readonly GradientType[] = ["linear", "radial"];
const shapes: readonly ShapeType[] = ["square", "circle"];

function gradientOf(value: unknown): Gradient | undefined {
  if (!isRecord(value)) return undefined;
  const type = oneOf(gradientTypes, value.type);
  const stops = Array.isArray(value.colorStops)
    ? value.colorStops.flatMap((stop: unknown) => {
        if (!isRecord(stop)) return [];
        const offset = number(stop.offset);
        const color = text(stop.color);
        return offset === undefined || !color ? [] : [{ offset, color }];
      })
    : [];
  if (!type || stops.length === 0) return undefined;
  const rotation = number(value.rotation);
  return {
    type,
    colorStops: stops,
    ...(rotation === undefined ? {} : { rotation }),
  };
}

const group = (stored: Stored, key: string): Stored => {
  const value = stored[key];
  return isRecord(value) ? value : {};
};

function paint<T extends string>(part: Stored, types: readonly T[]) {
  const type = oneOf(types, part.type);
  const color = text(part.color);
  const gradient = gradientOf(part.gradient);
  return {
    ...(type ? { type } : {}),
    ...(color ? { color } : {}),
    ...(gradient ? { gradient } : {}),
  };
}

/**
 * qr-code-styling options from what is stored, the way legacy renders it.
 * Values outside the library's unions fall back to its defaults.
 */
export function printedOptions(stored: Stored, data: string): PrintedQrOptions {
  const width = number(stored.width) ?? 300;
  const height = number(stored.height) ?? width;
  const margin = number(stored.margin);
  const image = text(stored.image);
  const shape = oneOf(shapes, stored.shape);
  const qr = group(stored, "qrOptions");
  const level = oneOf(levels, qr.errorCorrectionLevel);
  const logo = group(stored, "imageOptions");
  const crossOrigin = text(logo.crossOrigin);
  const logoMargin = number(logo.margin);
  const imageSize = number(logo.imageSize);
  const hideBackgroundDots = flag(logo.hideBackgroundDots);
  const dots = group(stored, "dotsOptions");
  const roundSize = flag(dots.roundSize);
  const background = group(stored, "backgroundOptions");
  const backgroundColor = text(background.color);
  const backgroundGradient = gradientOf(background.gradient);
  const round = number(background.round);
  return {
    type: "svg",
    width,
    height,
    data: text(stored.data) ?? data,
    ...(margin === undefined ? {} : { margin }),
    ...(image ? { image } : {}),
    ...(shape ? { shape } : {}),
    ...(isRecord(stored.frameOptions)
      ? { frameOptions: stored.frameOptions as QrDesign["frameOptions"] }
      : {}),
    ...(level ? { qrOptions: { errorCorrectionLevel: level } } : {}),
    imageOptions: {
      ...(crossOrigin ? { crossOrigin } : {}),
      ...(logoMargin === undefined ? {} : { margin: logoMargin }),
      ...(imageSize === undefined ? {} : { imageSize }),
      ...(hideBackgroundDots === undefined ? {} : { hideBackgroundDots }),
    },
    dotsOptions: {
      ...paint(dots, dotTypes),
      ...(roundSize === undefined ? {} : { roundSize }),
    },
    backgroundOptions: {
      ...(backgroundColor ? { color: backgroundColor } : {}),
      ...(backgroundGradient ? { gradient: backgroundGradient } : {}),
      ...(round === undefined ? {} : { round }),
    },
    cornersSquareOptions: paint(
      group(stored, "cornersSquareOptions"),
      cornerSquareTypes,
    ),
    cornersDotOptions: paint(
      group(stored, "cornersDotOptions"),
      cornerDotTypes,
    ),
  };
}

/**
 * What the server stores after an edit: option groups merge one level deep,
 * so a legacy gradient survives a colour change in the same group.
 */
export function mergeDesign(stored: Stored, edit: QrDesign): Stored {
  const merged: Stored = { ...stored };
  for (const [key, value] of Object.entries(edit)) {
    const before = stored[key];
    merged[key] =
      isRecord(value) && isRecord(before) ? { ...before, ...value } : value;
  }
  return merged;
}

export const gradientParts = [
  "dotsOptions",
  "cornersSquareOptions",
  "cornersDotOptions",
  "backgroundOptions",
] as const;
export type GradientPart = (typeof gradientParts)[number];

/** Option groups drawn with a gradient the editor can't change. */
export const gradientsIn = (stored: Stored): GradientPart[] =>
  gradientParts.filter((part) => gradientOf(group(stored, part).gradient));

/** Pixel size the code is drawn at, for true-size previews. */
export const printedSize = (stored: Stored) => {
  const width = number(stored.width) ?? 300;
  return { width, height: number(stored.height) ?? width };
};
