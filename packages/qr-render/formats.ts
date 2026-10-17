import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { Resvg, initWasm } from "@resvg/resvg-wasm";
import { PDFDocument } from "pdf-lib";
import { renderQrSvg, type QrLogo } from "./svg";

export type QrExportFormat = "svg" | "png" | "pdf";
export const QR_RENDER_VERSION = "2";
let initialized: Promise<void> | undefined;

async function wasmReady() {
  initialized ??= readFile(
    new URL(import.meta.resolve("@resvg/resvg-wasm/index_bg.wasm")),
  ).then((bytes) => initWasm(bytes));
  await initialized;
}

export function prepareQrExport(
  stored: Record<string, unknown>,
  data: string,
  format: QrExportFormat,
  size = 1024,
  logo?: QrLogo,
) {
  if (!["svg", "png", "pdf"].includes(format))
    throw new Error("invalid_format");
  const { svg, plan } = renderQrSvg(stored, data, size, logo);
  const designHash = createHash("sha256")
    .update(`${QR_RENDER_VERSION}:${format}:${svg}`)
    .digest("hex");
  const contentType =
    format === "svg"
      ? "image/svg+xml"
      : format === "png"
        ? "image/png"
        : "application/pdf";
  return { svg, plan, format, designHash, contentType };
}

export async function renderPreparedQr(
  prepared: ReturnType<typeof prepareQrExport>,
) {
  const { svg, plan, format, designHash, contentType } = prepared;
  const size = plan.size;
  let bytes = new Uint8Array(Buffer.from(svg));
  if (format !== "svg") {
    await wasmReady();
    const renderer = new Resvg(svg, {
      font: { loadSystemFonts: false },
      dpi: 300,
    });
    try {
      const image = renderer.render();
      try {
        bytes = new Uint8Array(image.asPng());
      } finally {
        image.free();
      }
    } finally {
      renderer.free();
    }
  }
  if (format === "pdf") {
    const pdf = await PDFDocument.create();
    // The page is sized for 300 dpi, rather than stretching a small bitmap.
    const points = (size / 300) * 72;
    const page = pdf.addPage([points, points]);
    const image = await pdf.embedPng(bytes);
    page.drawImage(image, { x: 0, y: 0, width: points, height: points });
    pdf.setProducer(`Shortn QR renderer ${QR_RENDER_VERSION}`);
    pdf.setCreator("Shortn");
    pdf.setCreationDate(new Date(0));
    pdf.setModificationDate(new Date(0));
    bytes = new Uint8Array(await pdf.save());
  }
  return { bytes, contentType, format, designHash, plan };
}

export async function renderQrExport(
  stored: Record<string, unknown>,
  data: string,
  format: QrExportFormat,
  size = 1024,
  logo?: QrLogo,
) {
  return renderPreparedQr(prepareQrExport(stored, data, format, size, logo));
}
