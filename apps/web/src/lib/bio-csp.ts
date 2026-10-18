// Built per request, not in next.config: config headers are evaluated at
// build time, and builds are shared between environments.
export function bioCsp(env: {
  BIO_API_ORIGIN?: string | undefined;
  NODE_ENV?: string | undefined;
}) {
  const dev = env.NODE_ENV === "development" ? " 'unsafe-eval'" : "";
  return [
    "default-src 'self'",
    "base-uri 'none'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "img-src 'self' https: data:",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    `script-src 'self' 'unsafe-inline'${dev}`,
    `connect-src 'self'${env.BIO_API_ORIGIN ? ` ${env.BIO_API_ORIGIN}` : ""}`,
    "frame-src https://www.youtube-nocookie.com https://open.spotify.com https://player.vimeo.com https://w.soundcloud.com https://embed.music.apple.com",
    "form-action 'none'",
  ].join("; ");
}
