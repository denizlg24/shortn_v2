export function creationUrl(value: string) {
  const text = value.trim();
  if (!text || text.length > 2048 || /\s/.test(text)) return null;
  try {
    const url = new URL(/^https?:\/\//i.test(text) ? text : `https://${text}`);
    if (
      !["https:", "http:"].includes(url.protocol) ||
      url.username ||
      url.password ||
      !url.hostname.includes(".")
    )
      return null;
    return url.href;
  } catch {
    return null;
  }
}
export function pastedCreationUrl(value: string) {
  return /^https?:\/\//i.test(value.trim()) ? creationUrl(value) : null;
}
