// Edge-safe: no database or Node dependencies.
export const reservedBioHandles = new Set(
  "app api www assets status docs blog mail email admin help support billing dashboard static cdn m mcp dev staging test ns1 ns2 smtp imap ftp cname web-origin redirect-origin api-origin legacy-origin app-staging api-staging web-staging redirect-staging shortn abuse fuck shit".split(
    " ",
  ),
);
export const validBioHandle = (handle: string, migrated = false) =>
  new RegExp(
    migrated
      ? "^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$"
      : "^[a-z0-9](?:[a-z0-9-]{1,28}[a-z0-9])$",
  ).test(handle) && !reservedBioHandles.has(handle);
export function bioHandleFromHost(host: string, root: string) {
  if (!host.endsWith(`.${root}`)) return null;
  const handle = host.slice(0, -(root.length + 1));
  return validBioHandle(handle, true) ? handle : null;
}
export function bioCanonical(
  handle: string,
  rootOrigin: string,
  subdomains: boolean,
  customDomain?: string,
) {
  if (customDomain) return `https://${customDomain}/`;
  const origin = new URL(rootOrigin);
  return subdomains
    ? `${origin.protocol}//${handle}.${origin.host}/`
    : new URL(`/_bio/${encodeURIComponent(handle)}`, origin).href;
}
