// Built per request, not in next.config: config headers are evaluated at
// build time, and builds are shared between environments. Next reads the nonce
// from the request's copy of this header and stamps it on its own scripts.
// The edge caches the HTML together with this header, which is safe: content
// stored before a render cannot know the nonce that render picks.
export function bioCsp(
  env: {
    BIO_API_ORIGIN?: string | undefined;
    NODE_ENV?: string | undefined;
  },
  nonce: string,
) {
  const dev = env.NODE_ENV === "development" ? " 'unsafe-eval'" : "";
  return [
    "default-src 'self'",
    "base-uri 'none'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "img-src 'self' https: data:",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev}`,
    `connect-src 'self'${env.BIO_API_ORIGIN ? ` ${env.BIO_API_ORIGIN}` : ""}`,
    "frame-src https://www.youtube-nocookie.com https://open.spotify.com https://player.vimeo.com https://w.soundcloud.com https://embed.music.apple.com",
    "form-action 'none'",
    "worker-src 'none'",
    "manifest-src 'self'",
  ].join("; ");
}
