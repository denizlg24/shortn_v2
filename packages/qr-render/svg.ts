import { composeQrTreatment } from "./treatment";
import QRDot from "./figures/QRDot";
import QRCornerSquare, {
  availableCornerSquareTypes,
} from "./figures/QRCornerSquare";
import QRCornerDot, { availableCornerDotTypes } from "./figures/QRCornerDot";
import { dotTypes } from "./figures/types";
import { SvgElement, svgWindow } from "./svg-node";
import { planQrPrint, printColor, QrPrintError, record } from "./print";

type Stored = Record<string, unknown>;
export interface QrLogo {
  png: Uint8Array;
  width: number;
  height: number;
}
const node = (
  tag: string,
  attributes: Record<string, string | number> = {},
) => {
  const result = new SvgElement(tag);
  for (const [key, value] of Object.entries(attributes))
    result.setAttribute(key, String(value));
  return result;
};
const number = (value: unknown, fallback: number) =>
  typeof value === "number" && Number.isFinite(value) ? value : fallback;
const mask = (ring: boolean, row: number, col: number) =>
  row >= 0 &&
  col >= 0 &&
  row < 7 &&
  col < 7 &&
  (ring
    ? row === 0 || col === 0 || row === 6 || col === 6
    : row >= 2 && row <= 4 && col >= 2 && col <= 4);

/** In-memory SVG only. Logos must already be bounded PNGs from trusted storage. */
export function renderQrSvg(
  stored: Stored,
  fallbackData: string,
  size = 1024,
  logo?: QrLogo,
) {
  const plan = planQrPrint(stored, fallbackData, size);
  const outputSize = size;
  size = plan.coreSize;
  const svg = node("svg", {
    xmlns: "http://www.w3.org/2000/svg",
    width: size,
    height: size,
    viewBox: `0 0 ${size} ${size}`,
  });
  if (record(stored.dotsOptions).roundSize === false)
    svg.setAttribute("shape-rendering", "crispEdges");
  const defs = node("defs");
  svg.appendChild(defs);
  let nextId = 0;
  const paint = (
    part: Stored,
    fallback: string,
    x: number,
    y: number,
    width: number,
    height: number,
    rotation = 0,
  ) => {
    const gradient = record(part.gradient);
    if (part.gradient === undefined) return printColor(part.color, fallback);
    const id = `qr-paint-${nextId++}`;
    let element: SvgElement;
    if (gradient.type === "radial") {
      element = node("radialGradient", {
        id,
        gradientUnits: "userSpaceOnUse",
        cx: x + width / 2,
        cy: y + height / 2,
        fx: x + width / 2,
        fy: y + height / 2,
        r: Math.max(width, height) / 2,
      });
    } else {
      const angle = number(gradient.rotation, 0) + rotation;
      const cos = Math.cos(angle),
        sin = Math.sin(angle);
      const dx =
        Math.abs(cos) >= Math.abs(sin)
          ? (Math.sign(cos) * width) / 2
          : (Math.sign(sin) * width) / 2 / Math.tan(angle);
      const dy =
        Math.abs(cos) >= Math.abs(sin)
          ? ((Math.sign(cos) * height) / 2) * Math.tan(angle)
          : (Math.sign(sin) * height) / 2;
      element = node("linearGradient", {
        id,
        gradientUnits: "userSpaceOnUse",
        x1: Math.round(x + width / 2 - dx),
        y1: Math.round(y + height / 2 - dy),
        x2: Math.round(x + width / 2 + dx),
        y2: Math.round(y + height / 2 + dy),
      });
    }
    for (const value of gradient.colorStops as unknown[]) {
      const stop = record(value);
      element.appendChild(
        node("stop", {
          offset: `${Number(stop.offset) * 100}%`,
          "stop-color": printColor(stop.color, fallback),
        }),
      );
    }
    defs.appendChild(element);
    return `url(#${id})`;
  };
  const background = record(stored.backgroundOptions);
  svg.appendChild(
    node("rect", {
      width: size,
      height: size,
      rx: (Math.max(0, Math.min(1, number(background.round, 0))) * size) / 2,
      fill: paint(background, "#fff", 0, 0, size, size),
    }),
  );
  const dots = record(stored.dotsOptions),
    square = record(stored.cornersSquareOptions),
    center = record(stored.cornersDotOptions);
  const style = (value: unknown, fallback = "square") =>
    Object.values(dotTypes).includes(String(value)) ? String(value) : fallback;
  const dotPaint = paint(dots, "#000", 0, 0, size, size);
  const dotClip = node("clipPath", { id: "qr-dots" });
  defs.appendChild(dotClip);
  svg.appendChild(
    node("rect", {
      width: size,
      height: size,
      fill: dotPaint,
      "clip-path": "url(#qr-dots)",
    }),
  );
  const { matrix, moduleSize: unit, margin: inset } = plan;
  const count = matrix.size;
  let hiddenX = 0,
    hiddenY = 0,
    logoWidth = 0,
    logoHeight = 0;
  if (plan.image) {
    if (
      !logo ||
      logo.png.length < 24 ||
      logo.png.length > 5 * 1024 * 1024 ||
      Buffer.from(logo.png.subarray(0, 8)).toString("hex") !==
        "89504e470d0a1a0a" ||
      Buffer.from(logo.png).readUInt32BE(16) !== logo.width ||
      Buffer.from(logo.png).readUInt32BE(20) !== logo.height ||
      logo.width < 1 ||
      logo.height < 1 ||
      logo.width > 4096 ||
      logo.height > 4096
    )
      throw new QrPrintError("logo_unavailable");
    const imageOptions = record(stored.imageOptions);
    const imageSize = number(imageOptions.imageSize, 0.4);
    if (imageSize < 0 || imageSize > 1)
      throw new QrPrintError("invalid_design");
    const ratio = logo.height / logo.width;
    const budget = Math.floor(imageSize * 0.3 * count * count);
    if (budget > 0) {
      hiddenX = Math.max(
        1,
        Math.min(count - 14, Math.floor(Math.sqrt(budget / ratio))),
      );
      if (hiddenX % 2 === 0) hiddenX--;
      logoWidth = hiddenX * unit;
      hiddenY = 1 + 2 * Math.ceil((hiddenX * ratio - 1) / 2);
      logoHeight = Math.round(logoWidth * ratio);
      if (hiddenY * hiddenX > budget || hiddenY > count - 14) {
        hiddenY = Math.min(hiddenY - 2, count - 14);
        if (hiddenY % 2 === 0) hiddenY--;
        logoHeight = hiddenY * unit;
        hiddenX = 1 + 2 * Math.ceil((hiddenY / ratio - 1) / 2);
        logoWidth = Math.round(logoHeight / ratio);
      }
    }
  }
  const finder = (row: number, col: number) =>
    (row < 7 && (col < 7 || col >= count - 7)) || (col < 7 && row >= count - 7);
  const imageOptions = record(stored.imageOptions);
  const visible = (row: number, col: number) =>
    matrix.dark(row, col) &&
    !finder(row, col) &&
    !(
      imageOptions.hideBackgroundDots !== false &&
      row >= (count - hiddenY) / 2 &&
      row < (count + hiddenY) / 2 &&
      col >= (count - hiddenX) / 2 &&
      col < (count + hiddenX) / 2
    );
  const dot = new QRDot({ svg, type: style(dots.type), window: svgWindow });
  for (let row = 0; row < count; row++)
    for (let col = 0; col < count; col++) {
      if (!visible(row, col)) continue;
      dot.draw(inset + col * unit, inset + row * unit, unit, (dx, dy) =>
        visible(row + dy, col + dx),
      );
      if (dot._element) dotClip.appendChild(dot._element);
    }
  for (const [col, row, rotation] of [
    [0, 0, 0],
    [count - 7, 0, Math.PI / 2],
    [0, count - 7, -Math.PI / 2],
  ] as const) {
    const x = inset + col * unit,
      y = inset + row * unit;
    let squareClip = dotClip,
      centerClip = dotClip;
    const hasSquarePaint =
      square.color !== undefined || square.gradient !== undefined;
    const hasCenterPaint =
      center.color !== undefined || center.gradient !== undefined;
    if (hasSquarePaint) {
      const id = `qr-square-${col}-${row}`;
      squareClip = centerClip = node("clipPath", { id });
      defs.appendChild(squareClip);
      svg.appendChild(
        node("rect", {
          x,
          y,
          width: unit * 7,
          height: unit * 7,
          fill: paint(square, "#000", x, y, unit * 7, unit * 7, rotation),
          "clip-path": `url(#${id})`,
        }),
      );
    }
    if (hasCenterPaint) {
      const id = `qr-center-${col}-${row}`;
      centerClip = node("clipPath", { id });
      defs.appendChild(centerClip);
      svg.appendChild(
        node("rect", {
          x: x + unit * 2,
          y: y + unit * 2,
          width: unit * 3,
          height: unit * 3,
          fill: paint(
            center,
            "#000",
            x + unit * 2,
            y + unit * 2,
            unit * 3,
            unit * 3,
            rotation,
          ),
          "clip-path": `url(#${id})`,
        }),
      );
    }
    for (const ring of [true, false]) {
      const part = ring ? square : center,
        clip = ring ? squareClip : centerClip;
      const supported = ring
        ? availableCornerSquareTypes
        : availableCornerDotTypes;
      if (supported.includes(String(part.type))) {
        const figure = ring
          ? new QRCornerSquare({
              svg,
              type: String(part.type),
              window: svgWindow,
            })
          : new QRCornerDot({
              svg,
              type: String(part.type),
              window: svgWindow,
            });
        figure.draw(
          x + (ring ? 0 : unit * 2),
          y + (ring ? 0 : unit * 2),
          unit * (ring ? 7 : 3),
          rotation,
        );
        if (figure._element) clip.appendChild(figure._element);
      } else {
        const figure = new QRDot({
          svg,
          type: style(part.type, style(dots.type)),
          window: svgWindow,
        });
        for (let r = 0; r < 7; r++)
          for (let c = 0; c < 7; c++) {
            if (!mask(ring, r, c)) continue;
            figure.draw(x + c * unit, y + r * unit, unit, (dx, dy) =>
              mask(ring, r + dy, c + dx),
            );
            if (figure._element) clip.appendChild(figure._element);
          }
      }
    }
  }
  if (plan.image && logo && logoWidth > 0 && logoHeight > 0) {
    const margin = Math.floor(
      (number(imageOptions.margin, 0) * size) / number(stored.width, 300),
    );
    if (margin < 0 || margin * 2 >= Math.min(logoWidth, logoHeight))
      throw new QrPrintError("invalid_design");
    svg.appendChild(
      node("image", {
        href: `data:image/png;base64,${Buffer.from(logo.png).toString("base64")}`,
        x: inset + Math.floor(margin + (count * unit - logoWidth) / 2),
        y: inset + Math.floor(margin + (count * unit - logoHeight) / 2),
        width: logoWidth - margin * 2,
        height: logoHeight - margin * 2,
      }),
    );
  }
  return { svg: composeQrTreatment(svg.toString(), stored, outputSize), plan };
}
