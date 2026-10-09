export function isApplePlatform(): boolean {
  if (typeof navigator === "undefined") return true;
  const platform =
    (navigator as Navigator & { userAgentData?: { platform?: string } })
      .userAgentData?.platform ?? navigator.platform;
  return /mac|iphone|ipad|ipod/i.test(platform);
}

/** True when the event comes from a field where typed characters must not trigger shortcuts. */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  if (
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement
  )
    return true;
  if (target instanceof HTMLInputElement) {
    return ![
      "checkbox",
      "radio",
      "button",
      "submit",
      "reset",
      "range",
      "color",
    ].includes(target.type);
  }
  return target.getAttribute("role") === "combobox";
}
