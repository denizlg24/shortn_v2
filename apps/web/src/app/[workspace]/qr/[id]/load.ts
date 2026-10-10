import { cache } from "react";
import { getQrAction } from "@/server/actions/qr";

// Metadata and the page read the same QR within one request.
export const loadQr = cache(getQrAction);
