import { cn } from "@shortn/ui";
import { Link, MessageCircle } from "lucide-react";
import type { ReactNode } from "react";

// Brand colours legacy's public page uses when the icon colour is
// "original". Its LinkedIn value is malformed, so that icon inherits the
// page's text colour there; null keeps that.
const brandColor: Record<string, string | null> = {
  instagram: "#FF0069",
  twitter: "#000000",
  github: "#181717",
  facebook: "#0866FF",
  youtube: "#FF0000",
  linkedin: null,
  whatsapp: "#25D366",
};

const stroke = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

const glyphs: Record<string, ReactNode> = {
  instagram: (
    <g {...stroke}>
      <rect x="2" y="2" width="20" height="20" rx="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <path d="M17.5 6.5h.01" />
    </g>
  ),
  twitter: (
    <path
      fill="currentColor"
      d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z"
    />
  ),
  github: (
    <path
      fill="currentColor"
      transform="scale(1.5)"
      d="M8 0c4.42 0 8 3.58 8 8a8.013 8.013 0 0 1-5.45 7.59c-.4.08-.55-.17-.55-.38 0-.27.01-1.13.01-2.2 0-.75-.25-1.23-.54-1.48 1.78-.2 3.65-.88 3.65-3.95 0-.88-.31-1.59-.82-2.15.08-.2.36-1.02-.08-2.12 0 0-.67-.22-2.2.82-.64-.18-1.32-.27-2-.27-.68 0-1.36.09-2 .27-1.53-1.03-2.2-.82-2.2-.82-.44 1.1-.16 1.92-.08 2.12-.51.56-.82 1.28-.82 2.15 0 3.06 1.86 3.75 3.64 3.95-.23.2-.44.55-.51 1.07-.46.21-1.61.55-2.33-.66-.15-.24-.6-.83-1.23-.82-.67.01-.27.38.01.53.34.19.73.9.82 1.13.16.45.68 1.31 2.69.94 0 .67.01 1.3.01 1.49 0 .21-.15.45-.55.38A7.995 7.995 0 0 1 0 8c0-4.42 3.58-8 8-8Z"
    />
  ),
  facebook: (
    <path
      {...stroke}
      d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"
    />
  ),
  youtube: (
    <g {...stroke}>
      <path d="M2.5 17a24.12 24.12 0 0 1 0-10 2 2 0 0 1 1.4-1.4 49.56 49.56 0 0 1 16.2 0A2 2 0 0 1 21.5 7a24.12 24.12 0 0 1 0 10 2 2 0 0 1-1.4 1.4 49.55 49.55 0 0 1-16.2 0A2 2 0 0 1 2.5 17" />
      <path d="m10 15 5-3-5-3z" />
    </g>
  ),
  linkedin: (
    <g {...stroke}>
      <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
      <rect x="2" y="9" width="4" height="12" />
      <circle cx="4" cy="4" r="2" />
    </g>
  ),
};

/**
 * A social platform's mark. `color` overrides the brand colour ("original"
 * on the page); unknown platforms get a plain link mark, as legacy draws.
 */
export function SocialIcon({
  platform,
  color,
  className,
}: {
  platform: string;
  color?: string | undefined;
  className?: string;
}) {
  const brand = brandColor[platform];
  const tint =
    color ?? (brand === undefined ? "#000000" : (brand ?? undefined));
  const style = tint ? { color: tint } : undefined;
  const classes = cn("size-5 shrink-0", className);
  const glyph = glyphs[platform];
  if (glyph)
    return (
      <svg viewBox="0 0 24 24" aria-hidden className={classes} style={style}>
        {glyph}
      </svg>
    );
  const Icon = platform === "whatsapp" ? MessageCircle : Link;
  return <Icon aria-hidden className={classes} style={style} />;
}
