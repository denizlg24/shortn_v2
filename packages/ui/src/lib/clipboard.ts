let liveRegion: HTMLElement | null = null;

/** Polite screen-reader announcement through a single shared live region. */
export function announce(message: string): void {
  if (typeof document === "undefined") return;
  if (!liveRegion || !liveRegion.isConnected) {
    liveRegion = document.createElement("div");
    liveRegion.setAttribute("role", "status");
    liveRegion.setAttribute("aria-live", "polite");
    Object.assign(liveRegion.style, {
      position: "absolute",
      width: "1px",
      height: "1px",
      margin: "-1px",
      overflow: "hidden",
      clip: "rect(0 0 0 0)",
      whiteSpace: "nowrap",
    });
    document.body.append(liveRegion);
  }
  liveRegion.textContent = "";
  const region = liveRegion;
  window.setTimeout(() => {
    region.textContent = message;
  }, 30);
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const field = document.createElement("textarea");
    field.value = text;
    field.setAttribute("readonly", "");
    field.style.position = "fixed";
    field.style.opacity = "0";
    document.body.append(field);
    field.select();
    const copied = document.execCommand("copy");
    field.remove();
    return copied;
  }
}

export function shortUrl(domain: string, key: string): string {
  return `https://${domain}/${key}`;
}
