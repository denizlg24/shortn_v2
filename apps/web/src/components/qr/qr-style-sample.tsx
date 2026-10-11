"use client";

import { Skeleton } from "@shortn/ui";
import { useEffect, useState } from "react";
import type { CornerStyle, DotStyle } from "./qr-draft";
import { printedOptions } from "./qr-options";
import { renderQrUrl } from "./qr-render";

export type SamplePart = "dots" | "cornerSquare" | "cornerDot";

// 29 modules at 8 px: the drawing is exactly 232 px with no margin.
const drawn = 232;
const shown = 40;
const crop = 60;
const sampleData = "https://shortn.at/preview";

// A sample is the same for every editor, so each is drawn once per visit.
const samples = new Map<string, Promise<string>>();

function sampleUrl(part: SamplePart, style: string) {
  const key = `${part}:${style}`;
  let sample = samples.get(key);
  if (!sample) {
    sample = renderQrUrl(
      printedOptions(
        {
          width: drawn,
          height: drawn,
          margin: 0,
          qrOptions: { errorCorrectionLevel: "Q" },
          dotsOptions: {
            color: "#0f172b",
            type: part === "dots" ? style : "square",
          },
          backgroundOptions: { color: "#ffffff" },
          ...(part === "cornerSquare"
            ? { cornersSquareOptions: { type: style } }
            : {}),
          ...(part === "cornerDot"
            ? { cornersDotOptions: { type: style } }
            : {}),
        },
        sampleData,
      ),
    ).then((rendered) => rendered.url);
    samples.set(key, sample);
  }
  return sample;
}

/** A close-up of one style, drawn by the library itself: corners show the
 * top-left finder, dots the middle of the code. */
export function QrStyleSample({
  part,
  style,
}: {
  part: SamplePart;
  style: DotStyle | CornerStyle;
}) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    sampleUrl(part, style).then(
      (next) => {
        if (live) setUrl(next);
      },
      () => {},
    );
    return () => {
      live = false;
    };
  }, [part, style]);

  const scale = shown / crop;
  const offset = part === "dots" ? -((drawn - crop) / 2) * scale : 0;
  return (
    <span
      aria-hidden
      className="relative block overflow-hidden rounded-chip"
      style={{ width: shown, height: shown, background: "#ffffff" }}
    >
      {url ? (
        <img
          src={url}
          alt=""
          draggable={false}
          className="absolute max-w-none"
          style={{
            width: drawn * scale,
            height: drawn * scale,
            left: offset,
            top: offset,
          }}
        />
      ) : (
        <Skeleton className="size-full rounded-chip" />
      )}
    </span>
  );
}
