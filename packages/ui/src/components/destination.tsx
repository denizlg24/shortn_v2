import { Globe } from "lucide-react";
import { useState } from "react";
import { cn } from "../lib/cn";
import { Tooltip } from "./tooltip";

export interface ParsedDestination {
  host: string;
  /** Path plus query and hash. */
  rest: string;
  /** What a dense row shows: the path, keeping the query only when the path alone says little (`/watch?v=…`). */
  display: string;
}

const MEANINGFUL_PATH_LENGTH = 12;

export function parseDestination(url: string): ParsedDestination {
  try {
    const parsed = new URL(url);
    const path = parsed.pathname === "/" ? "" : parsed.pathname;
    const query = `${parsed.search}${parsed.hash}`;
    return {
      host: parsed.host.replace(/^www\./, ""),
      rest: safeDecode(`${path}${query}`),
      display: safeDecode(
        path.length > MEANINGFUL_PATH_LENGTH ? path : `${path}${query}`,
      ),
    };
  } catch {
    return { host: url, rest: "", display: "" };
  }
}

function safeDecode(value: string): string {
  try {
    return decodeURI(value);
  } catch {
    return value;
  }
}

/** Keeps the end of the slug readable: the tail starts at a word boundary within the last ~20 characters. */
function splitForMiddleTruncation(value: string): [string, string] {
  if (value.length <= 24) return [value, ""];
  const window = value.slice(-20);
  const boundary = window.search(/[-/_.]/);
  const tailLength =
    boundary >= 0 && boundary < 12 ? window.length - boundary : 14;
  return [
    value.slice(0, value.length - tailLength),
    value.slice(value.length - tailLength),
  ];
}

export interface FaviconProps {
  host: string;
  src?: string | undefined;
  className?: string;
}

export function Favicon({ host, src, className }: FaviconProps) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <Globe
        aria-hidden
        className={cn("size-4 shrink-0 text-fg-subtle", className)}
        strokeWidth={1.75}
      />
    );
  }
  return (
    <img
      src={src}
      alt=""
      width={16}
      height={16}
      loading="lazy"
      decoding="async"
      data-host={host}
      onError={() => setFailed(true)}
      className={cn("size-4 shrink-0 rounded-[3px]", className)}
    />
  );
}

export interface DestinationProps {
  url: string;
  faviconSrc?: string | undefined;
  showFavicon?: boolean;
  /** Full URL in a tooltip on hover. Off inside dense lists where the row already exposes it. */
  showFullOnHover?: boolean;
  className?: string;
}

export function Destination({
  url,
  faviconSrc,
  showFavicon = true,
  showFullOnHover = true,
  className,
}: DestinationProps) {
  const { host, display } = parseDestination(url);
  const [head, tail] = splitForMiddleTruncation(display);

  const content = (
    <span
      className={cn("flex min-w-0 items-center gap-2 text-small", className)}
    >
      {showFavicon ? <Favicon host={host} src={faviconSrc} /> : null}
      <span className="flex min-w-0 flex-1 items-baseline">
        <span className="max-w-[60%] shrink-0 truncate text-fg-muted">
          {host}
        </span>
        {head ? (
          <span className="min-w-[2ch] truncate text-fg-subtle">{head}</span>
        ) : null}
        {tail ? (
          <span className="shrink-0 whitespace-pre text-fg-subtle">{tail}</span>
        ) : null}
      </span>
    </span>
  );

  if (!showFullOnHover) return content;
  return (
    <Tooltip
      content={<span className="line-clamp-6 break-all">{url}</span>}
      side="bottom"
      align="start"
      className="max-w-120"
    >
      {content}
    </Tooltip>
  );
}
