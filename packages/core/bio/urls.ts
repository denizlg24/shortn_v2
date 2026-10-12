export function safeBioUrl(value: string): string | undefined {
  try {
    const parsed = new URL(value);
    return ["https:", "http:"].includes(parsed.protocol) &&
      !parsed.username &&
      !parsed.password
      ? parsed.href
      : undefined;
  } catch {
    return undefined;
  }
}

export function bioEmbedUrl(
  provider: string,
  value: string,
): string | undefined {
  const safe = safeBioUrl(value);
  if (!safe) return;
  const url = new URL(safe),
    host = url.hostname.replace(/^www\./, "");
  if (provider === "youtube" && ["youtube.com", "youtu.be"].includes(host)) {
    const id =
      host === "youtu.be"
        ? url.pathname.slice(1)
        : (url.searchParams.get("v") ?? url.pathname.split("/").at(-1));
    if (id && /^[\w-]{11}$/.test(id))
      return `https://www.youtube-nocookie.com/embed/${id}`;
  }
  if (
    provider === "spotify" &&
    host === "open.spotify.com" &&
    /^\/(track|album|playlist|episode|show)\/[a-zA-Z0-9]+$/.test(url.pathname)
  )
    return `https://open.spotify.com/embed${url.pathname}`;
  if (
    provider === "vimeo" &&
    host === "vimeo.com" &&
    /^\/\d+$/.test(url.pathname)
  )
    return `https://player.vimeo.com/video${url.pathname}`;
  if (provider === "soundcloud" && host === "soundcloud.com")
    return `https://w.soundcloud.com/player/?url=${encodeURIComponent(url.origin + url.pathname)}`;
  if (provider === "apple-music" && host === "music.apple.com")
    return `https://embed.music.apple.com${url.pathname}`;
}
