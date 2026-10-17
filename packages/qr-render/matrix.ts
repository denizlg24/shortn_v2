import QRCode from "qrcode";
import legacyEncoder from "qrcode-generator";

export type ErrorCorrection = "L" | "M" | "Q" | "H";
export interface QrMatrix {
  size: number;
  version: number;
  mask: number;
  dark: (row: number, column: number) => boolean;
}

/**
 * Keep qr-code-styling's single-segment encoding and mask choice. node-qrcode's
 * automatic mixed segments and penalty score otherwise change the drawing.
 * The generated matrix comes from node-qrcode; the old encoder is only the
 * compatibility oracle for format bits (mask selection), not the SVG renderer.
 */
export function qrMatrix(data: string, correction: ErrorCorrection): QrMatrix {
  if (!data || data.length > 2048) throw new Error("invalid_data");
  const mode = /^[0-9]+$/.test(data)
    ? "Numeric"
    : /^[0-9A-Z $%*+\-./:]+$/.test(data)
      ? "Alphanumeric"
      : "Byte";
  const reference = legacyEncoder(0, correction);
  reference.addData(data, mode);
  reference.make();
  const size = reference.getModuleCount();
  const version = (size - 17) / 4;
  // qr-code-styling 1.9.2's encoder uses low bytes of UTF-16 code units.
  // Preserve stored legacy data exactly; newly created codes encode ASCII URLs.
  const segment: QRCode.QRCodeSegment =
    mode === "Byte"
      ? {
          mode: "byte",
          data: new Uint8Array(
            Array.from(
              { length: data.length },
              (_, i) => data.charCodeAt(i) & 255,
            ),
          ),
        }
      : mode === "Numeric"
        ? { mode: "numeric", data }
        : { mode: "alphanumeric", data };
  for (let mask = 0; mask < 8; mask++) {
    const result = QRCode.create([segment], {
      version,
      errorCorrectionLevel: correction,
      maskPattern: mask as QRCode.QRCodeMaskPattern,
    });
    // Vertical format bits uniquely identify error correction and mask.
    if (
      Array.from({ length: 9 }, (_, row) => row)
        .filter((row) => row !== 6)
        .every(
          (row) =>
            Boolean(result.modules.get(row, 8)) === reference.isDark(row, 8),
        )
    ) {
      return {
        size,
        version,
        mask,
        dark: (row, column) =>
          row >= 0 &&
          column >= 0 &&
          row < size &&
          column < size &&
          Boolean(result.modules.get(row, column)),
      };
    }
  }
  throw new Error("incompatible_matrix");
}
