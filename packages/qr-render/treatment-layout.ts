import supported from "./fonts/supported.json";
const characters = new Set(supported);
const record = (value: unknown): Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
export const captionText = (value: string) =>
  value.normalize("NFC").trim().replace(/\s+/gu, " ");
export function validQrCaption(value: string): boolean {
  return (
    value.length <= 64 &&
    ![...value].some((char) => {
      const code = char.codePointAt(0)!;
      return code < 32 || (code >= 127 && code <= 159);
    }) &&
    [...captionText(value)].every((char) =>
      characters.has(char.codePointAt(0)!),
    )
  );
}
/** Decoration bounds never overlap the inner QR's four-module quiet zone. */
export function treatmentLayout(stored: Record<string, unknown>, size: number) {
  const shape = stored.shape ?? "square";
  const options = record(stored.frameOptions);
  const frame = options.style ?? "none";
  const rawCaption = options.caption ?? "";
  if (
    !["square", "circle"].includes(String(shape)) ||
    !["none", "outline", "solid"].includes(String(frame)) ||
    typeof rawCaption !== "string" ||
    !validQrCaption(rawCaption)
  )
    throw new Error("invalid_design");
  const caption = captionText(rawCaption),
    enabled = shape !== "square" || frame !== "none" || caption !== "";
  const graphicSize = caption ? Math.floor(size * 0.78) : size;
  const coreSize = enabled
    ? Math.floor(
        graphicSize * (shape === "circle" ? 0.66 : frame === "none" ? 1 : 0.88),
      )
    : size;
  return {
    shape,
    frame,
    caption,
    enabled,
    graphicSize,
    coreSize,
    x: Math.floor((size - coreSize) / 2),
    y: Math.floor((graphicSize - coreSize) / 2),
  };
}
