import type { Options } from "qr-code-styling";
import type { PrintedQrOptions } from "./qr-options";
import { parseColor } from "./qr-scan-check";

const renderTimeoutMs = 10_000;
const probeTimeoutMs = 8_000;

// Browser-only and ~50 kB: loaded on the first render, never on the server.
let styling: Promise<typeof import("qr-code-styling").default> | null = null;
const loadStyling = () =>
  (styling ??= import("qr-code-styling").then((module) => module.default));

/** Same code at another pixel size; margins scale with it. */
export function scaled(options: Options, size: number): Options {
  const factor = size / (options.width ?? size);
  const imageMargin = options.imageOptions?.margin;
  return {
    ...options,
    width: size,
    height: size,
    ...(options.margin === undefined
      ? {}
      : { margin: Math.round(options.margin * factor) }),
    imageOptions: {
      ...options.imageOptions,
      ...(imageMargin === undefined
        ? {}
        : { margin: Math.round(imageMargin * factor) }),
    },
  };
}

const probes = new Map<string, Promise<boolean>>();

// qr-code-styling never settles when a logo fails to load (it only listens
// for `load`), so each logo is tried first the way the library loads it.
function logoLoads(url: string): Promise<boolean> {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:")
      return Promise.resolve(false);
  } catch {
    return Promise.resolve(false);
  }
  let probe = probes.get(url);
  if (!probe) {
    probe = new Promise<boolean>((resolve) => {
      const image = new Image();
      image.crossOrigin = "anonymous";
      const timer = window.setTimeout(() => resolve(false), probeTimeoutMs);
      image.onload = () => {
        window.clearTimeout(timer);
        resolve(true);
      };
      image.onerror = () => {
        window.clearTimeout(timer);
        resolve(false);
      };
      image.src = url;
    });
    probes.set(url, probe);
  }
  return probe;
}

function withTimeout<T>(promise: Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(
      () => reject(new Error("QR render timed out")),
      renderTimeoutMs,
    );
    promise.then(
      (value) => {
        window.clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        window.clearTimeout(timer);
        reject(error instanceof Error ? error : new Error(String(error)));
      },
    );
  });
}

type Format = "svg" | "png" | "jpeg";

export async function renderQrBlob(
  options: PrintedQrOptions,
  format: Format,
): Promise<Blob> {
  const QRCodeStyling = await loadStyling();
  const [{ qrMatrix }, { treatmentLayout }] = await Promise.all([
    import("@shortn/qr-render/matrix"),
    import("@shortn/qr-render/treatment-layout"),
  ]);
  const size = options.width ?? 300;
  const layout = treatmentLayout(options as Record<string, unknown>, size);
  const correction =
    options.image || options.qrOptions?.errorCorrectionLevel === "H"
      ? "H"
      : "Q";
  const count = qrMatrix(options.data ?? "", correction).size;
  const margin = Math.max(
    Math.ceil(((options.margin ?? 0) * layout.coreSize) / size),
    Math.ceil((layout.coreSize * 4) / (count + 8)),
  );
  const unit =
    options.dotsOptions?.roundSize === false
      ? (layout.coreSize - margin * 2) / count
      : Math.floor((layout.coreSize - margin * 2) / count);
  if (unit < 1) throw new Error("invalid_size");
  const inset =
    options.dotsOptions?.roundSize === false
      ? margin
      : Math.floor((layout.coreSize - count * unit) / 2);
  const ready: Options = {
    ...options,
    type: "svg",
    shape: "square",
    width: layout.coreSize,
    height: layout.coreSize,
    margin: inset,
    qrOptions: { ...options.qrOptions, errorCorrectionLevel: correction },
    imageOptions: {
      ...options.imageOptions,
      margin: Math.floor(
        ((options.imageOptions?.margin ?? 0) * layout.coreSize) / size,
      ),
    },
  };
  const data = await withTimeout(
    new QRCodeStyling(ready).getRawData(layout.enabled ? "svg" : format),
  );
  if (!(data instanceof Blob)) throw new Error("QR render failed");
  if (!layout.enabled) return data;
  const { composeQrTreatment } = await import("@shortn/qr-render/treatment");
  const svg = composeQrTreatment(
    await data.text(),
    options as Record<string, unknown>,
    size,
  );
  const blob = new Blob([svg], { type: "image/svg+xml" });
  if (format === "svg") return blob;
  const url = URL.createObjectURL(blob);
  try {
    const image = new Image();
    image.src = url;
    await withTimeout(image.decode());
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = size;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("QR render failed");
    if (format === "jpeg") {
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, size, size);
    }
    context.drawImage(image, 0, 0);
    return await withTimeout(
      new Promise<Blob>((resolve, reject) =>
        canvas.toBlob(
          (result) =>
            result ? resolve(result) : reject(new Error("QR render failed")),
          `image/${format}`,
        ),
      ),
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}

export interface Rendered {
  url: string;
  /** The logo couldn't be loaded, so the code was drawn without it. */
  logoFailed: boolean;
}

/** An object URL of the code as SVG; revoke it when it's replaced. */
export async function renderQrUrl(options: Options): Promise<Rendered> {
  const logoFailed = options.image ? !(await logoLoads(options.image)) : false;
  const usable = logoFailed ? { ...options, image: "" } : options;
  const blob = await renderQrBlob(usable, "svg");
  return { url: URL.createObjectURL(blob), logoFailed };
}

export type DownloadResult = "done" | "logo_failed" | "failed";

export async function downloadQr(
  options: Options,
  format: Format,
  name: string,
): Promise<DownloadResult> {
  if (options.image && !(await logoLoads(options.image))) return "logo_failed";
  // JPEG has no transparency: a see-through background would turn black.
  const background = parseColor(options.backgroundOptions?.color ?? "#fff");
  const ready =
    format === "jpeg" && background && background.a < 1
      ? { ...options, backgroundOptions: { color: "#ffffff" } }
      : options;
  try {
    const blob = await renderQrBlob(ready, format);
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${name}.${format === "jpeg" ? "jpg" : format}`;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    return "done";
  } catch {
    return "failed";
  }
}
