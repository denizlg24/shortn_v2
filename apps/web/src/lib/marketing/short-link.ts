const keyPattern = /^[A-Za-z0-9_-]{1,64}$/;

/** The key of a short link on one of `hosts`, typed with or without a scheme. */
export function shortLinkKey(input: string, hosts: readonly string[]) {
  const value = input.trim();
  if (keyPattern.test(value)) return value;
  let url: URL;
  try {
    url = new URL(
      /^[a-z][a-z0-9+.-]*:\/\//i.test(value) ? value : `https://${value}`,
    );
  } catch {
    return null;
  }
  if (!hosts.includes(url.hostname.toLowerCase())) return null;
  const key = decodeURIComponent(url.pathname.slice(1).replace(/\/$/, ""));
  return keyPattern.test(key) ? key : null;
}
