/** Reverse normalized DNS labels so anchored prefix scans include subdomains. */
export function destinationHostRev(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (!["http:", "https:"].includes(parsed.protocol)) return null;
    const host = parsed.hostname.toLowerCase().replace(/\.$/, "");
    return host ? host.split(".").reverse().join(".") : null;
  } catch {
    return null;
  }
}
