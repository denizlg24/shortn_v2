import { useMemo } from "react";
import { encode } from "uqr";
import { cn } from "../lib/cn";

export interface QRPreviewProps {
  value: string;
  /** Rendered size in CSS pixels. */
  size?: number;
  label: string;
  className?: string;
}

export function qrSvgMarkup(
  value: string,
  foreground = "#0f172b",
  background = "#ffffff",
): string {
  const { data, size } = encode(value, { ecc: "M", border: 2 });
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges"><rect width="${size}" height="${size}" fill="${background}"/><path fill="${foreground}" d="${modulePath(data)}"/></svg>`;
}

function modulePath(data: boolean[][]): string {
  return data
    .flatMap((row, y) =>
      row.flatMap((dark, x) => (dark ? [`M${x} ${y}h1v1h-1z`] : [])),
    )
    .join("");
}

export function QRPreview({
  value,
  size = 160,
  label,
  className,
}: QRPreviewProps) {
  const { path, modules } = useMemo(() => {
    const result = encode(value, { ecc: "M", border: 2 });
    return { path: modulePath(result.data), modules: result.size };
  }, [value]);
  return (
    <svg
      role="img"
      aria-label={label}
      width={size}
      height={size}
      viewBox={`0 0 ${modules} ${modules}`}
      shapeRendering="crispEdges"
      className={cn("shrink-0 rounded-control", className)}
    >
      <rect width={modules} height={modules} fill="#ffffff" />
      <path d={path} className="fill-brand" />
    </svg>
  );
}
