import { tourSelector, type TourAnchor } from "@/lib/tour/anchors";

const visible = (element: Element) =>
  element.getClientRects().length > 0 &&
  getComputedStyle(element).visibility !== "hidden";

/** The first rendered, visible element for an anchor (the same anchor can exist in the sidebar and the mobile drawer). */
export function findAnchor(anchor: TourAnchor): Element | null {
  for (const element of document.querySelectorAll(tourSelector(anchor)))
    if (visible(element)) return element;
  return null;
}

const present = (anchor: TourAnchor) =>
  document.querySelector(tourSelector(anchor)) !== null;

/**
 * Resolves once `ready()` holds, re-checking on every DOM change, or with
 * false after `timeout` ms or when `signal` aborts.
 */
export function waitUntil(
  ready: () => boolean,
  timeout: number,
  signal: AbortSignal,
): Promise<boolean> {
  if (ready()) return Promise.resolve(true);
  return new Promise((resolve) => {
    const finish = (value: boolean) => {
      observer.disconnect();
      clearTimeout(timer);
      clearInterval(poll);
      signal.removeEventListener("abort", abort);
      resolve(value);
    };
    const check = () => {
      if (ready()) finish(true);
    };
    const abort = () => finish(false);
    const observer = new MutationObserver(check);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
    });
    // Client navigations change the URL without touching the DOM.
    const poll = setInterval(check, 100);
    const timer = setTimeout(() => finish(false), timeout);
    signal.addEventListener("abort", abort);
  });
}

/**
 * Waits for an anchor to render. One that is rendered but hidden by the
 * layout (desktop-only UI on a phone) resolves to null at once: waiting
 * would not make it appear.
 */
export async function waitForAnchor(
  anchor: TourAnchor,
  timeout: number,
  signal: AbortSignal,
): Promise<Element | null> {
  await waitUntil(() => present(anchor), timeout, signal);
  return findAnchor(anchor);
}

export const escapeHtml = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

export function element<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

const svgNamespace = "http://www.w3.org/2000/svg";

/** A 16px lucide-style stroke icon from path data, built without innerHTML. */
export function strokeIcon(paths: readonly string[], className: string) {
  const svg = document.createElementNS(svgNamespace, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "2");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("class", className);
  for (const d of paths) {
    const path = document.createElementNS(svgNamespace, "path");
    path.setAttribute("d", d);
    svg.append(path);
  }
  return svg;
}

export const lockIcon = [
  "M7 11V7a5 5 0 0 1 10 0v4",
  "M5 11h14a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2z",
] as const;

export const arrowUpRightIcon = ["M7 7h10v10", "M7 17 17 7"] as const;
