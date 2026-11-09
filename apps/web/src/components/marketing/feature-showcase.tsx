"use client";

import { cn } from "@shortn/ui";
import { useEffect, useRef, useState } from "react";

interface Capture {
  src: string;
  width: number;
  height: number;
}

export interface ShowcaseItem {
  id: string;
  title: string;
  body: string;
  alt: string;
  light: Capture;
  dark: Capture;
}

const cycleMs = 6500;

/**
 * Advances through the features while it is on screen. Hovering or focusing
 * the list holds the current one, and reduced motion never advances it.
 */
export function FeatureShowcase({ items }: { items: ShowcaseItem[] }) {
  const [active, setActive] = useState(0);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [running, setRunning] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = root.current;
    if (!node) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    let visible = false;
    const update = () => setRunning(visible && !reduced.matches);
    const observer = new IntersectionObserver(
      ([entry]) => {
        visible = Boolean(entry?.isIntersecting);
        update();
      },
      { threshold: 0.35 },
    );
    observer.observe(node);
    reduced.addEventListener("change", update);
    return () => {
      observer.disconnect();
      reduced.removeEventListener("change", update);
    };
  }, []);

  const advancing = running && !hovered && !focused;

  useEffect(() => {
    if (!advancing) return;
    const timer = window.setTimeout(
      () => setActive((index) => (index + 1) % items.length),
      cycleMs,
    );
    return () => window.clearTimeout(timer);
  }, [active, advancing, items.length]);

  return (
    <div
      ref={root}
      className="grid items-center gap-10 lg:grid-cols-12 lg:gap-14"
    >
      <ul
        className="flex flex-col lg:col-span-4"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onFocus={() => setFocused(true)}
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget))
            setFocused(false);
        }}
      >
        {items.map((item, index) => {
          const current = index === active;
          return (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => setActive(index)}
                aria-pressed={current}
                className="relative block w-full rounded-control py-4 pl-6 text-left md:py-5"
              >
                <span
                  aria-hidden
                  className="absolute inset-y-0 left-0 w-px bg-line-strong"
                />
                <span
                  aria-hidden
                  className={cn(
                    "absolute top-0 left-0 w-px bg-signal ease-linear motion-reduce:transition-none",
                    current ? "h-full" : "h-0",
                  )}
                  style={{
                    transitionProperty: "height",
                    transitionDuration:
                      current && advancing ? `${cycleMs}ms` : "240ms",
                  }}
                />
                <span
                  className={cn(
                    "block font-display text-title leading-snug font-extrabold tracking-[-0.02em] text-balance transition-colors",
                    current ? "text-fg" : "text-fg-subtle hover:text-fg-muted",
                  )}
                >
                  {item.title}
                </span>
                <span
                  className={cn(
                    "grid transition-[grid-template-rows,opacity] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none",
                    current
                      ? "grid-rows-[1fr] opacity-100"
                      : "grid-rows-[0fr] opacity-0",
                  )}
                >
                  <span className="overflow-hidden">
                    <span className="block pt-2 text-body leading-relaxed text-pretty text-fg-muted md:text-emphasis">
                      {item.body}
                    </span>
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <div className="showcase-well relative aspect-[4/3] overflow-hidden rounded-[18px] ring-1 ring-line lg:col-span-8">
        {items.map((item, index) => (
          <div
            key={item.id}
            aria-hidden={index !== active}
            className={cn(
              "absolute inset-0 flex items-center justify-center p-4 transition-[opacity,translate,filter] duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none sm:p-8",
              index === active
                ? "translate-y-0 opacity-100 blur-0"
                : "pointer-events-none translate-y-3 opacity-0 blur-[2px]",
            )}
          >
            <Shot capture={item.light} alt={item.alt} className="dark:hidden" />
            <Shot
              capture={item.dark}
              alt={item.alt}
              className="hidden dark:block"
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function Shot({
  capture,
  alt,
  className,
}: {
  capture: Capture;
  alt: string;
  className: string;
}) {
  return (
    // Plain <img>: /_next/image is not routed on the root host.
    <img
      src={capture.src}
      width={capture.width}
      height={capture.height}
      alt={alt}
      loading="lazy"
      decoding="async"
      className={cn(
        "max-h-full w-auto max-w-full rounded-overlay object-contain shadow-[0_28px_60px_-24px_oklch(0.2_0.05_265/40%),0_0_0_1px_oklch(0.2_0.05_265/8%)] dark:shadow-[0_28px_60px_-24px_oklch(0_0_0/70%),0_0_0_1px_oklch(1_0_0/8%)]",
        className,
      )}
    />
  );
}
