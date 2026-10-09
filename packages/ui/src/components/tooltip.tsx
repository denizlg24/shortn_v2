import { Tooltip as TooltipPrimitive } from "radix-ui";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "../lib/cn";
import { KeyboardHint, type KeyboardHintProps } from "./keyboard-hint";

export function TooltipProvider({
  delayDuration = 450,
  skipDelayDuration = 250,
  ...props
}: ComponentProps<typeof TooltipPrimitive.Provider>) {
  return (
    <TooltipPrimitive.Provider
      delayDuration={delayDuration}
      skipDelayDuration={skipDelayDuration}
      {...props}
    />
  );
}

export interface TooltipProps {
  content: ReactNode;
  shortcut?: KeyboardHintProps["keys"];
  shortcutSequence?: boolean;
  side?: ComponentProps<typeof TooltipPrimitive.Content>["side"];
  align?: ComponentProps<typeof TooltipPrimitive.Content>["align"];
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  className?: string;
  children: ReactNode;
}

export function Tooltip({
  content,
  shortcut,
  shortcutSequence,
  side = "top",
  align = "center",
  open,
  onOpenChange,
  className,
  children,
}: TooltipProps) {
  return (
    <TooltipPrimitive.Root
      {...(open === undefined ? {} : { open })}
      {...(onOpenChange ? { onOpenChange } : {})}
    >
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          side={side}
          align={align}
          sideOffset={6}
          collisionPadding={8}
          className={cn(
            "z-50 flex max-w-[min(320px,calc(100vw-16px))] origin-(--radix-tooltip-content-transform-origin) items-center gap-2 rounded-control bg-tooltip px-2 py-1 text-meta text-tooltip-fg shadow-overlay",
            "data-[state=delayed-open]:animate-overlay-in data-[state=instant-open]:animate-overlay-in data-[state=closed]:animate-overlay-out",
            className,
          )}
        >
          <span className="min-w-0 text-pretty">{content}</span>
          {shortcut ? (
            <KeyboardHint
              keys={shortcut}
              {...(shortcutSequence ? { sequence: true } : {})}
              tone="inverse"
            />
          ) : null}
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}
