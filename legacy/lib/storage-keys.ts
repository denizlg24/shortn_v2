// Keys are decoded exactly once at the HTTP boundary. Never normalize traversal.
export function isValidUploadKey(key: string): boolean {
  const segments = key.split("/");
  return (
    segments.length >= 3 &&
    segments[0] === "uploads" &&
    segments.every(
      (segment) =>
        /^[a-zA-Z0-9_.@|+-]+$/.test(segment) &&
        segment !== "." &&
        !segment.includes(".."),
    )
  );
}

export function isOwnedUploadKey(key: string, userSub: string): boolean {
  return (
    !!userSub &&
    !userSub.includes("/") &&
    isValidUploadKey(key) &&
    key.startsWith(`uploads/${userSub}/`)
  );
}

export function assetUrl(key: string): string {
  if (!isValidUploadKey(key)) throw new Error("Invalid asset key");
  const base = new URL(process.env.NEXT_PUBLIC_APP_URL!);
  base.pathname = `${base.pathname.replace(/\/$/, "")}/api/assets/${key.split("/").map(encodeURIComponent).join("/")}`;
  base.search = "";
  base.hash = "";
  return base.toString();
}

export function keyFromAssetUrl(url: string): string | null {
  try {
    const base = new URL(process.env.NEXT_PUBLIC_APP_URL!);
    const asset = new URL(url);
    const prefix = `${base.pathname.replace(/\/$/, "")}/api/assets/`;
    // URL() normalizes dot segments; inspect the original path as well.
    const rawPath = url.match(/^https?:\/\/[^/?#]+([^?#]*)/)?.[1];
    if (
      asset.origin !== base.origin ||
      asset.username ||
      asset.password ||
      asset.search ||
      asset.hash ||
      rawPath !== asset.pathname ||
      !asset.pathname.startsWith(prefix)
    ) {
      return null;
    }
    const key = asset.pathname
      .slice(prefix.length)
      .split("/")
      .map(decodeURIComponent)
      .join("/");
    // Encoded separators are not valid key segments.
    if (
      asset.pathname.slice(prefix.length).split("/").length !==
      key.split("/").length
    ) {
      return null;
    }
    return isValidUploadKey(key) ? key : null;
  } catch {
    return null;
  }
}
