export interface StructuralResult {
  ok: boolean;
  reason?: string;
  signals: string[];
}

const ALLOWED_PROTOCOLS = ["http:", "https:"];

const EXECUTABLE_EXTENSIONS = [
  ".exe",
  ".msi",
  ".dmg",
  ".pkg",
  ".apk",
  ".bat",
  ".cmd",
  ".com",
  ".scr",
  ".jar",
  ".sh",
  ".ps1",
  ".vbs",
  ".deb",
  ".rpm",
];

const ARCHIVE_EXTENSIONS = [".zip", ".rar", ".7z", ".gz", ".tar", ".iso"];

const SUSPICIOUS_TLDS = [
  "zip",
  "mov",
  "tk",
  "ml",
  "cf",
  "ga",
  "gq",
  "country",
  "kim",
  "work",
  "click",
  "link",
  "rest",
  "fit",
  "men",
  "loan",
  "download",
  "review",
  "top",
];

function isIpLiteral(hostname: string): boolean {
  const host = hostname.replace(/^\[|\]$/g, "");
  const ipv4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
  if (ipv4.test(host)) return true;
  if (host.includes(":")) return true; // IPv6 literal
  return false;
}

function isPrivateOrLocalHost(hostname: string): boolean {
  const host = hostname.replace(/^\[|\]$/g, "").toLowerCase();

  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    host === "0.0.0.0"
  ) {
    return true;
  }

  const ipv4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4) {
    const [a, b] = ipv4.slice(1).map(Number);
    if (a === 10) return true;
    if (a === 127) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 169 && b === 254) return true; // link-local / cloud metadata
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
  }

  if (
    host === "::1" ||
    host.startsWith("fc") ||
    host.startsWith("fd") ||
    host.startsWith("fe80")
  ) {
    return true;
  }

  return false;
}

function getTld(hostname: string): string {
  const parts = hostname.toLowerCase().split(".");
  return parts.length > 1 ? parts[parts.length - 1] : "";
}

function hasExtension(pathname: string, extensions: string[]): boolean {
  const lower = pathname.toLowerCase();
  return extensions.some((ext) => lower.endsWith(ext));
}

export function validateDestination(rawUrl: string): StructuralResult {
  const signals: string[] = [];

  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return { ok: false, reason: "invalid-url", signals: ["invalid-url"] };
  }

  if (!ALLOWED_PROTOCOLS.includes(url.protocol)) {
    return {
      ok: false,
      reason: "invalid-protocol",
      signals: ["invalid-protocol"],
    };
  }

  if (isPrivateOrLocalHost(url.hostname)) {
    return {
      ok: false,
      reason: "private-network",
      signals: ["private-network"],
    };
  }

  if (isIpLiteral(url.hostname)) {
    return { ok: false, reason: "ip-literal", signals: ["ip-literal"] };
  }

  if (hasExtension(url.pathname, EXECUTABLE_EXTENSIONS)) {
    return {
      ok: false,
      reason: "executable-download",
      signals: ["executable-download"],
    };
  }

  // Soft signals: do not hard-reject, but raise the risk score.
  if (hasExtension(url.pathname, ARCHIVE_EXTENSIONS)) {
    signals.push("archive-download");
  }

  if (SUSPICIOUS_TLDS.includes(getTld(url.hostname))) {
    signals.push("suspicious-tld");
  }

  if (url.hostname.split(".").length > 4) {
    signals.push("deep-subdomain");
  }

  if (/^[\d.]+$/.test(url.hostname.replace(/\./g, ""))) {
    signals.push("numeric-host");
  }

  return { ok: true, signals };
}
