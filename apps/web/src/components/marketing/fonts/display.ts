import localFont from "next/font/local";

// Latin covers en, pt and es. next/font preloads it and sizes the fallback to
// its metrics, so the display headline doesn't shift when it swaps in.
export const displayFace = localFont({
  src: "./schibsted-grotesk-latin-wght-normal.woff2",
  weight: "400 900",
  display: "swap",
  variable: "--font-display-face",
  fallback: ["Geist Variable", "system-ui", "sans-serif"],
});
