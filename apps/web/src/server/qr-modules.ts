import "server-only";
import QRCode from "qrcode";
import type { QrModules } from "@/components/marketing/qr-matrix";

export function qrModules(text: string): QrModules {
  const { modules } = QRCode.create(text, { errorCorrectionLevel: "M" });
  let bits = "";
  for (const value of modules.data) bits += value ? "1" : "0";
  return { size: modules.size, bits };
}
