import { useEffect, useRef, useState, type MouseEvent } from "react";
import { useUILocale } from "../i18n/provider";
import { announce, copyText, shortUrl } from "../lib/clipboard";
import { cn } from "../lib/cn";

const COPIED_MS = 2000;

export interface ShortLinkProps {
  domain: string;
  linkKey: string;
  size?: "sm" | "md" | "lg";
  /** `hover` reveals the copy affordance only when an ancestor `.group` is hovered or focused. */
  reveal?: "always" | "hover";
  /** Timestamp of a copy made elsewhere (⌘C on a row, create-and-copy); shows the copied state while recent. */
  copiedAt?: number | undefined;
  onCopy?: (url: string) => void;
  tabIndex?: number;
  className?: string;
}

export function ShortLink({
  domain,
  linkKey,
  size = "md",
  reveal = "always",
  copiedAt,
  onCopy,
  tabIndex,
  className,
}: ShortLinkProps) {
  const { t } = useUILocale();
  const [copied, setCopied] = useState(
    () => copiedAt !== undefined && Date.now() - copiedAt < COPIED_MS,
  );
  const timer = useRef<number | undefined>(undefined);

  const flash = (duration: number) => {
    setCopied(true);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setCopied(false), duration);
  };

  useEffect(() => {
    if (copiedAt === undefined) return;
    const remaining = COPIED_MS - (Date.now() - copiedAt);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- freshness depends on the wall clock, which render must not read
    if (remaining > 0) flash(remaining);
  }, [copiedAt]);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const handleClick = async (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    const url = shortUrl(domain, linkKey);
    const ok = await copyText(url);
    if (!ok) {
      announce(t.copyFailed);
      return;
    }
    flash(COPIED_MS);
    announce(t.copiedAnnouncement(`${domain}/${linkKey}`));
    onCopy?.(url);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      tabIndex={tabIndex}
      aria-label={`${t.copyShortLink}: ${domain}/${linkKey}`}
      data-copied={copied || undefined}
      className={cn(
        "group/short-link inline-flex max-w-full min-w-0 cursor-copy items-center gap-1.5 rounded-chip text-left outline-offset-1",
        size === "sm" && "text-small",
        size === "md" && "text-small",
        size === "lg" && "text-emphasis",
        className,
      )}
    >
      <span className="flex min-w-0 items-baseline">
        <span className="shrink-0 text-fg-subtle">{domain}/</span>
        <span className="truncate font-medium text-fg group-hover/short-link:underline group-hover/short-link:decoration-line-strong">
          {linkKey}
        </span>
      </span>
      <CopyMorph
        copied={copied}
        className={cn(
          size === "lg" ? "size-4" : "size-3.5",
          reveal === "hover" &&
            !copied &&
            "opacity-0 group-hover:opacity-100 group-focus-visible/short-link:opacity-100 group-focus-within:opacity-100",
        )}
      />
    </button>
  );
}

function CopyMorph({
  copied,
  className,
}: {
  copied: boolean;
  className?: string;
}) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn(
        "shrink-0 overflow-visible",
        copied ? "text-success" : "text-fg-subtle",
        className,
      )}
    >
      <g
        className="origin-center transition-[opacity,scale] duration-(--motion-fast) ease-overlay"
        style={{ opacity: copied ? 0 : 1, scale: copied ? "0.6" : "1" }}
      >
        <rect width="13" height="13" x="9" y="9" rx="2" />
        <path d="M5 15c-1.1 0-2-.9-2-2V5c0-1.1.9-2 2-2h8c1.1 0 2 .9 2 2" />
      </g>
      <path
        d="M20 6 9 17l-5-5"
        pathLength={1}
        strokeWidth={2.5}
        className="transition-[stroke-dashoffset] ease-overlay"
        style={{
          strokeDasharray: 1,
          strokeDashoffset: copied ? 0 : 1,
          transitionDuration: copied ? "220ms" : "0ms",
          transitionDelay: copied ? "60ms" : "0ms",
        }}
      />
    </svg>
  );
}
