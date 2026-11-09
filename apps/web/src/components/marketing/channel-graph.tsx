import { cn, ShortnMark } from "@shortn/ui";
import {
  Bot,
  Braces,
  CircleUserRound,
  Globe,
  Mail,
  MessageCircle,
  Package,
  QrCode,
  type LucideIcon,
} from "lucide-react";

export const channelIds = [
  "print",
  "newsletter",
  "social",
  "website",
  "bio",
  "packaging",
  "api",
  "agents",
] as const;
export type ChannelId = (typeof channelIds)[number];

const icons: Record<ChannelId, LucideIcon> = {
  print: QrCode,
  newsletter: Mail,
  social: MessageCircle,
  website: Globe,
  bio: CircleUserRound,
  packaging: Package,
  api: Braces,
  agents: Bot,
};

/** Positions in percent of the 1000×420 stage. */
const layout: Record<ChannelId, { x: number; y: number }> = {
  print: { x: 9, y: 24 },
  newsletter: { x: 24, y: 8 },
  social: { x: 27, y: 72 },
  website: { x: 41, y: 92 },
  bio: { x: 59, y: 92 },
  packaging: { x: 73, y: 72 },
  api: { x: 76, y: 8 },
  agents: { x: 91, y: 24 },
};

const hub = { x: 50, y: 44 };

function wire({ x, y }: { x: number; y: number }) {
  const midY = ((y + hub.y) / 2) * 4.2;
  return `M ${x * 10} ${y * 4.2} C ${x * 10} ${midY}, ${hub.x * 10} ${midY}, ${hub.x * 10} ${hub.y * 4.2}`;
}

/**
 * Where links get published, wired into the one place their clicks and scans
 * are counted. The pulses run toward the hub: traffic coming back.
 */
export function ChannelGraph({
  labels,
  hubLabel,
}: {
  labels: Record<ChannelId, string>;
  hubLabel: string;
}) {
  return (
    <>
      <div className="relative mx-auto hidden aspect-[1000/420] w-full max-w-[960px] md:block">
        <svg
          viewBox="0 0 1000 420"
          className="absolute inset-0 size-full overflow-visible"
          aria-hidden
        >
          <defs>
            <linearGradient id="channel-wire" x1="0" y1="0" x2="0" y2="1">
              <stop
                offset="0"
                stopColor="oklch(0.78 0.12 262)"
                stopOpacity="0.25"
              />
              <stop
                offset="1"
                stopColor="oklch(0.86 0.09 262)"
                stopOpacity="1"
              />
            </linearGradient>
          </defs>
          {channelIds.map((id, index) => (
            <g key={id}>
              <path
                d={wire(layout[id])}
                fill="none"
                stroke="oklch(1 0 0 / 12%)"
                strokeWidth="1"
              />
              <path
                d={wire(layout[id])}
                fill="none"
                stroke="url(#channel-wire)"
                strokeWidth="2"
                strokeLinecap="round"
                strokeDasharray="14 50"
                className="channel-flow"
                style={{ animationDelay: `${-((index * 1170) % 3200)}ms` }}
              />
            </g>
          ))}
        </svg>
        <div
          className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-3"
          style={{ left: `${hub.x}%`, top: `${hub.y}%` }}
        >
          <span className="relative flex size-[4.5rem] items-center justify-center rounded-[18px] bg-bg-subtle shadow-[0_0_64px_-6px_oklch(0.62_0.19_262/70%)] ring-1 ring-signal/50">
            <ShortnMark size={44} className="rounded-[10px]" />
          </span>
          <span className="rounded-full bg-bg/70 px-2.5 py-0.5 text-meta whitespace-nowrap text-fg-muted ring-1 ring-line">
            {hubLabel}
          </span>
        </div>
        {channelIds.map((id) => {
          const { x, y } = layout[id];
          const above = y < hub.y;
          const Icon = icons[id];
          return (
            <div
              key={id}
              className={cn(
                "absolute flex -translate-x-1/2 items-center gap-2",
                above
                  ? "-translate-y-[calc(100%-1.5rem)] flex-col-reverse"
                  : "-translate-y-6 flex-col",
              )}
              style={{ left: `${x}%`, top: `${y}%` }}
            >
              <span className="flex size-12 items-center justify-center rounded-[12px] bg-bg-subtle text-fg shadow-[inset_0_1px_0_oklch(1_0_0/8%)] ring-1 ring-line-strong">
                <Icon className="size-5" strokeWidth={1.6} aria-hidden />
              </span>
              <span className="text-meta whitespace-nowrap text-fg-muted">
                {labels[id]}
              </span>
            </div>
          );
        })}
      </div>
      <div className="flex flex-col items-center gap-6 md:hidden">
        <span className="flex size-16 items-center justify-center rounded-[16px] bg-bg-subtle shadow-[0_0_48px_-6px_oklch(0.62_0.19_262/70%)] ring-1 ring-signal/50">
          <ShortnMark size={38} className="rounded-[9px]" />
        </span>
        <ul className="grid w-full grid-cols-2 gap-px overflow-hidden rounded-[14px] bg-line ring-1 ring-line">
          {channelIds.map((id) => {
            const Icon = icons[id];
            return (
              <li
                key={id}
                className="flex min-w-0 items-center gap-2.5 bg-bg px-3 py-3 text-small text-fg-muted"
              >
                <Icon
                  className="size-4 shrink-0 text-fg"
                  strokeWidth={1.6}
                  aria-hidden
                />
                <span className="min-w-0 text-pretty">{labels[id]}</span>
              </li>
            );
          })}
        </ul>
      </div>
    </>
  );
}
