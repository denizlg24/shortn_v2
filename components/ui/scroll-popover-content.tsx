"use client";

import * as React from "react";
import { PopoverContent as ShadcnPopoverContent } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface AutoScrollPopoverContentProps
  extends React.ComponentPropsWithoutRef<typeof ShadcnPopoverContent> {
  scrollMargin?: number;
}

export const ScrollPopoverContent = React.forwardRef<
  React.ElementRef<typeof ShadcnPopoverContent>,
  AutoScrollPopoverContentProps
>(({ scrollMargin = 16, onOpenAutoFocus, className, ...props }, ref) => {
  const localRef = React.useRef<HTMLDivElement | null>(null);

  const handleOpenAutoFocus = (e: Event) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onOpenAutoFocus?.(e as any);

    if (!localRef.current) return;

    requestAnimationFrame(() => {
      const el = localRef.current!;
      const rect = el.getBoundingClientRect();
      const vh = window.innerHeight;

      const topOverflow = scrollMargin - rect.top;
      const bottomOverflow = rect.bottom - (vh - scrollMargin);

      if (topOverflow > 0 || bottomOverflow > 0) {
        let target = window.scrollY;
        if (topOverflow > 0) target = Math.max(0, target - topOverflow);
        if (bottomOverflow > 0) target = target + bottomOverflow + 24;
        window.scrollTo({ top: target, behavior: "smooth" });
      }
    });
  };

  return (
    <ShadcnPopoverContent
      ref={(node) => {
        localRef.current = node;
        if (typeof ref === "function") ref(node);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        else if (ref) (ref as React.MutableRefObject<any>).current = node;
      }}
      onOpenAutoFocus={handleOpenAutoFocus}
      className={cn(className)}
      {...props}
    />
  );
});

ScrollPopoverContent.displayName = "AutoScrollPopoverContent";
