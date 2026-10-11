import type { Options } from "qr-code-styling";
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

async function render(options: Options, format: Format): Promise<Blob> {
  const QRCodeStyling = await loadStyling();
  const data = await withTimeout(new QRCodeStyling(options).getRawData(format));
  if (!(data instanceof Blob)) throw new Error("QR render failed");
  return data;
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
  const blob = await render(usable, "svg");
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
    const blob = await render(ready, format);
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
