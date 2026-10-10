import { useMemo } from "react";
import { cn } from "../lib/cn";

export interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  /** Accessible summary. Without it the sparkline is decorative and hidden from assistive tech. */
  label?: string;
  className?: string;
}

const PAD = 2.5;

export function Sparkline({
  data,
  width = 80,
  height = 20,
  label,
  className,
}: SparklineProps) {
  const geometry = useMemo(() => {
    const max = Math.max(0, ...data);
    const span = Math.max(1, data.length - 1);
    const points = data.map((value, index) => {
      const x = PAD + (index / span) * (width - PAD * 2);
      const y =
        max === 0
          ? height - PAD
          : height - PAD - (value / max) * (height - PAD * 2);
      return [Number(x.toFixed(2)), Number(y.toFixed(2))] as const;
    });
    const path = points
      .map(([x, y], index) => `${index === 0 ? "M" : "L"}${x} ${y}`)
      .join(" ");
    return { path, last: points.at(-1), empty: max === 0 };
  }, [data, width, height]);

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={cn("shrink-0 overflow-visible", className)}
      {...(label
        ? { role: "img", "aria-label": label }
        : { "aria-hidden": true })}
    >
      <path
        d={geometry.path}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.25}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={geometry.empty ? "text-line-strong" : "text-fg-subtle"}
      />
      {geometry.last && !geometry.empty ? (
        <circle
          cx={geometry.last[0]}
          cy={geometry.last[1]}
          r={2}
          className="fill-chart-1"
        />
      ) : null}
    </svg>
  );
}
