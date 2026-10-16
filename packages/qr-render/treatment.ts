import Color from "colorjs.io";
import { parse, type Font } from "opentype.js";
import encoded from "./fonts/font.json";
import { treatmentLayout } from "./treatment-layout";
import { printColor, record } from "./print";
let font: Font | undefined;
function captionFont() {
  font ??= parse(
    Uint8Array.from(atob(encoded), (char) => char.charCodeAt(0)).buffer,
  );
  return font;
}
function captionPaths(text: string, size: number, top: number, color: string) {
  const face = captionFont(),
    available = size * 0.88;
  let fontSize = size * 0.045;
  let lines: string[];
  for (;;) {
    lines = [""];
    for (const character of text) {
      const line = lines.at(-1)!;
      if (line && face.getAdvanceWidth(line + character, fontSize) > available)
        lines.push(character);
      else lines[lines.length - 1] = line + character;
    }
    if (lines.length <= 2) break;
    fontSize *= 0.9;
  }
  const lineHeight = fontSize * 1.3;
  const baseline =
    top + (size - top - lines.length * lineHeight) / 2 + fontSize;
  return lines
    .map((line, index) => {
      const path = face.getPath(line.trim(), 0, 0, fontSize),
        box = path.getBoundingBox();
      const x = (size - (box.x2 - box.x1)) / 2 - box.x1;
      // Only trusted numeric font outlines enter markup; caption text never does.
      return `<path fill="${color}" transform="translate(${x} ${baseline + index * lineHeight})" d="${path.toPathData(3)}"/>`;
    })
    .join("");
}
/** Pure geometry and glyph paths shared by browser previews and worker exports. */
export function composeQrTreatment(
  baseSvg: string,
  stored: Record<string, unknown>,
  size: number,
): string {
  const layout = treatmentLayout(stored, size);
  if (!layout.enabled) return baseSvg;
  const color = (part: unknown, fallback: string) => {
    const value = record(part),
      stops = record(value.gradient).colorStops;
    return printColor(
      Array.isArray(stops) ? record(stops[0]).color : value.color,
      fallback,
    );
  };
  const foreground = color(stored.dotsOptions, "#000"),
    background = color(stored.backgroundOptions, "#fff");
  const fg = new Color(foreground).luminance,
    bg = new Color(background).luminance;
  const contrast = (Math.max(fg, bg) + 0.05) / (Math.min(fg, bg) + 0.05);
  const ink = contrast >= 4.5 ? foreground : bg >= 0.179 ? "#000" : "#fff";
  const edge = size * 0.02,
    width = layout.graphicSize - edge * 2,
    x = (size - width) / 2;
  const stroke =
    layout.frame === "outline"
      ? `stroke="${foreground}" stroke-width="${size * 0.008}"`
      : "";
  const fill = layout.frame === "solid" ? foreground : background;
  const badge =
    layout.shape === "circle"
      ? `<circle cx="${size / 2}" cy="${layout.graphicSize / 2}" r="${width / 2}" fill="${fill}" ${stroke}/>`
      : layout.frame !== "none"
        ? `<rect x="${x}" y="${edge}" width="${width}" height="${width}" rx="${size * 0.025}" fill="${fill}" ${stroke}/>`
        : "";
  const inner = baseSvg
    .replace(/<\?xml[^>]*\?>/g, "")
    .replace(/<svg\b/, `<svg x="${layout.x}" y="${layout.y}"`);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${layout.shape === "circle" ? "" : `<rect width="${size}" height="${size}" fill="${background}"/>`}${badge}${inner}${layout.caption ? `<rect y="${layout.graphicSize}" width="${size}" height="${size - layout.graphicSize}" fill="${background}"/>${captionPaths(layout.caption, size, layout.graphicSize, ink)}` : ""}</svg>`;
}
