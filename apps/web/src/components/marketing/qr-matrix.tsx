import { cn } from "@shortn/ui";

export interface QrModules {
  size: number;
  /** Row-major dark modules as "1"/"0". */
  bits: string;
}

/** One path per code, drawn from the encoder's modules with a 2-module quiet zone. */
export function QrMatrix({
  modules,
  label,
  className,
}: {
  modules: QrModules;
  label: string;
  className?: string;
}) {
  const quiet = 2;
  const span = modules.size + quiet * 2;
  let path = "";
  for (let y = 0; y < modules.size; y++)
    for (let x = 0; x < modules.size; x++)
      if (modules.bits[y * modules.size + x] === "1")
        path += `M${x + quiet} ${y + quiet}h1v1h-1z`;
  return (
    <svg
      viewBox={`0 0 ${span} ${span}`}
      role="img"
      aria-label={label}
      shapeRendering="crispEdges"
      className={cn("block", className)}
    >
      <rect width={span} height={span} fill="#ffffff" />
      <path d={path} fill="#0f172b" />
    </svg>
  );
}
