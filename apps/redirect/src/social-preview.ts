import type { SocialPreview } from "@shortn/core";
const escape = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ]!,
  );

export function socialPreviewPage(
  og: SocialPreview,
  canonical: string,
  destination: string,
): string {
  const title = og.title ?? new URL(canonical).pathname.slice(1);
  // A serialized HTTP(S) URL encodes double quotes; quoting the refresh URL
  // preserves literal apostrophes and semicolons in signed URLs and paths.
  const refresh = new URL(destination).toString();
  return `<!doctype html><html prefix="og: https://ogp.me/ns#"><head><meta charset="utf-8"><title>${escape(title)}</title>
<meta property="og:type" content="website"><meta property="og:title" content="${escape(title)}"><meta property="og:url" content="${escape(canonical)}">
${og.description ? `<meta property="og:description" content="${escape(og.description)}"><meta name="description" content="${escape(og.description)}">` : ""}
${og.image ? `<meta property="og:image" content="${escape(og.image)}"><meta property="og:image:alt" content="${escape(title)}">` : ""}
<meta name="twitter:card" content="${og.image ? "summary_large_image" : "summary"}"><meta name="twitter:title" content="${escape(title)}">
${og.description ? `<meta name="twitter:description" content="${escape(og.description)}">` : ""}
${og.image ? `<meta name="twitter:image" content="${escape(og.image)}">` : ""}
<link rel="canonical" href="${escape(canonical)}"><meta http-equiv="refresh" content="0;url=&quot;${escape(refresh)}&quot;"></head><body><a href="${escape(destination)}">${escape(title)}</a></body></html>`;
}
