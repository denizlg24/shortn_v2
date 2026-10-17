import { describe, expect, test } from "bun:test";
import jsQR from "jsqr";
import { PNG } from "pngjs";
import { PDFDocument } from "pdf-lib";
import { renderQrExport, renderQrSvg } from "./index";

const url = "https://shortn.at/print-test?qr=synthetic";
const decode = (bytes: Uint8Array) => {
  const png = PNG.sync.read(Buffer.from(bytes));
  return jsQR(new Uint8ClampedArray(png.data), png.width, png.height)?.data;
};

describe("styled QR artifacts", () => {
  test("six dot styles and six legacy finder styles render scannable PNGs", async () => {
    const styles = [
      "square",
      "dots",
      "rounded",
      "extra-rounded",
      "classy",
      "classy-rounded",
    ];
    for (const dot of styles)
      for (const corner of styles) {
        const result = await renderQrExport(
          {
            dotsOptions: { type: dot, color: "navy" },
            cornersSquareOptions: { type: corner },
            cornersDotOptions: { type: corner },
          },
          url,
          "png",
          512,
        );
        expect(result.contentType).toBe("image/png");
        expect(decode(result.bytes)).toBe(url);
      }
  }, 30_000);

  test("bounded embedded logo and gradients still decode", async () => {
    const png = new PNG({ width: 64, height: 64 });
    for (let index = 0; index < png.data.length; index += 4) {
      png.data[index] = 30;
      png.data[index + 1] = 90;
      png.data[index + 2] = 255;
      png.data[index + 3] = 255;
    }
    const logo = {
      png: new Uint8Array(PNG.sync.write(png)),
      width: 64,
      height: 64,
    };
    const stored = {
      image: "https://assets.example/synthetic-logo.png",
      dotsOptions: {
        type: "rounded",
        gradient: {
          type: "linear",
          rotation: Math.PI / 4,
          colorStops: [
            { offset: 0, color: "black" },
            { offset: 1, color: "navy" },
          ],
        },
      },
    };
    const result = await renderQrExport(stored, url, "png", 1024, logo);
    expect(result.plan.correction).toBe("H");
    expect(decode(result.bytes)).toBe(url);
    const svg = renderQrSvg(stored, url, 1024, logo).svg;
    expect(svg).toContain("data:image/png;base64,");
    expect(svg).not.toContain("https://assets.example");
    expect(() => renderQrSvg(stored, url)).toThrow("logo_unavailable");
    expect(() =>
      renderQrSvg(stored, url, 1024, { ...logo, width: 4097 }),
    ).toThrow("logo_unavailable");
  });

  test("SVG is deterministic, and cache identity includes rendering and format", async () => {
    const first = await renderQrExport({}, url, "svg");
    const repeated = await renderQrExport({}, url, "svg");
    const png = await renderQrExport({}, url, "png");
    const changed = await renderQrExport(
      { dotsOptions: { type: "dots" } },
      url,
      "svg",
    );
    const larger = await renderQrExport({}, url, "svg", 2048);
    expect(first.bytes).toEqual(repeated.bytes);
    expect(first.designHash).toBe(repeated.designHash);
    expect(first.designHash).not.toBe(png.designHash);
    expect(first.designHash).not.toBe(changed.designHash);
    expect(first.designHash).not.toBe(larger.designHash);
    expect(Buffer.from(first.bytes).toString()).toStartWith(
      '<svg xmlns="http://www.w3.org/2000/svg"',
    );
  });

  test("PDF has the intended physical size at 300 dpi and deterministic metadata", async () => {
    const result = await renderQrExport({}, url, "pdf", 1024);
    expect(result.contentType).toBe("application/pdf");
    const pdf = await PDFDocument.load(result.bytes);
    expect(pdf.getPageCount()).toBe(1);
    expect(pdf.getPage(0).getWidth()).toBeCloseTo((1024 / 300) * 72);
    expect(pdf.getPage(0).getHeight()).toBeCloseTo((1024 / 300) * 72);
    expect(pdf.getCreationDate()?.getTime()).toBe(0);
    expect(result.bytes).toEqual(
      (await renderQrExport({}, url, "pdf", 1024)).bytes,
    );
  });
});

describe("shape/frame/caption treatments", () => {
  test("every badge/frame combination keeps a scannable code and clear quiet zone", async () => {
    for (const shape of ["square", "circle"])
      for (const style of ["none", "outline", "solid"]) {
        const stored = {
          shape,
          frameOptions: { style, caption: "São João — escanea aquí" },
          dotsOptions: { type: "rounded", color: "navy" },
        };
        const result = await renderQrExport(stored, url, "png", 1024);
        expect(decode(result.bytes)).toBe(url);
        expect(result.plan.quietZoneModules).toBeGreaterThanOrEqual(4);
        expect(result.plan.coreSize).toBeLessThan(1024);
        expect(result.plan.minimumPrintMm).toBeGreaterThan(
          (await renderQrExport({}, url, "svg")).plan.minimumPrintMm,
        );
        const svg = renderQrSvg(stored, url).svg;
        expect(svg).not.toContain("<text");
        expect(svg).not.toContain("São João");
        expect(svg).toBe(renderQrSvg(stored, url).svg);
      }
  }, 30_000);
  test("bounded captions become numeric outlines, unsupported text is refused before export", async () => {
    for (const caption of [
      "W".repeat(64),
      'Scan <script> & "visit"',
      "¡Información! — Olá",
    ]) {
      const result = await renderQrExport(
        { frameOptions: { caption } },
        url,
        "png",
      );
      expect(decode(result.bytes)).toBe(url);
      const svg = renderQrSvg({ frameOptions: { caption } }, url).svg;
      expect(svg).not.toContain("<script>");
      expect(svg).not.toContain("onload=");
    }
    for (const caption of [
      "W".repeat(65),
      "No\nnewline",
      "Emoji 🎉",
      "Invisible\u200bmark",
    ]) {
      expect(() => renderQrSvg({ frameOptions: { caption } }, url)).toThrow(
        "invalid_design",
      );
    }
    expect(() => renderQrSvg({ shape: "triangle" }, url)).toThrow(
      "invalid_design",
    );
    expect(() =>
      renderQrSvg({ frameOptions: { style: "unknown" } }, url),
    ).toThrow("invalid_design");
  });
});

test("caption ink reaches text contrast independently of the scan threshold", () => {
  for (const [foreground, background, ink] of [
    ["#1e90ff", "#fff", "#000"],
    ["#666", "#000", "#fff"],
  ]) {
    const svg = renderQrSvg(
      {
        shape: "circle",
        frameOptions: { caption: "Readable caption" },
        dotsOptions: { color: foreground },
        backgroundOptions: { color: background },
      },
      url,
    ).svg;
    expect(svg).toContain(`<path fill="${ink}" transform=`);
  }
});
