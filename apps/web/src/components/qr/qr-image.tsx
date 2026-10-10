"use client";

import { cn, Skeleton } from "@shortn/ui";
import type { Options } from "qr-code-styling";
import { useEffect, useRef, useState } from "react";
import { renderQrUrl } from "./qr-render";

const revokeLater = (url: string) =>
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);

/**
 * A code drawn by qr-code-styling, shown as an image. The previous drawing
 * stays up while the next one renders, so editing never flickers. Pass a
 * memoized `options`: a new object means a new drawing.
 */
export function QrImage({
  options,
  size,
  alt,
  lazy = false,
  onRendered,
  className,
}: {
  options: Options;
  /** Displayed size in CSS pixels; the drawing keeps its own resolution. */
  size: number;
  alt: string;
  /** Waits until the image scrolls near the viewport (long grids). */
  lazy?: boolean;
  onRendered?: (result: { logoFailed: boolean }) => void;
  className?: string;
}) {
  const frame = useRef<HTMLDivElement>(null);
  const current = useRef<string | null>(null);
  const reported = useRef(onRendered);
  const [visible, setVisible] = useState(!lazy);
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    reported.current = onRendered;
  }, [onRendered]);

  useEffect(() => {
    if (visible || !frame.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "240px" },
    );
    observer.observe(frame.current);
    return () => observer.disconnect();
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    let live = true;
    renderQrUrl(options).then(
      (result) => {
        if (!live) {
          URL.revokeObjectURL(result.url);
          return;
        }
        const previous = current.current;
        current.current = result.url;
        setUrl(result.url);
        setFailed(false);
        if (previous) revokeLater(previous);
        reported.current?.({ logoFailed: result.logoFailed });
      },
      () => {
        if (live) setFailed(true);
      },
    );
    return () => {
      live = false;
    };
  }, [options, visible]);

  useEffect(
    () => () => {
      if (current.current) revokeLater(current.current);
    },
    [],
  );

  return (
    <div
      ref={frame}
      className={cn("relative grid shrink-0 place-items-center", className)}
      style={{ width: size, maxWidth: "100%", aspectRatio: "1" }}
    >
      {url ? (
        <img
          src={url}
          alt={alt}
          width={size}
          height={size}
          draggable={false}
          className="size-full object-contain"
        />
      ) : failed ? (
        <span className="text-meta text-fg-subtle">{alt}</span>
      ) : (
        <Skeleton className="size-full rounded-chip" />
      )}
    </div>
  );
}
