import { Tabs as TabsPrimitive } from "radix-ui";
import type { ComponentProps } from "react";
import { cn } from "../lib/cn";

export const Tabs = TabsPrimitive.Root;

export function TabsList({
  className,
  ...props
}: ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      className={cn(
        "flex items-stretch gap-5 overflow-x-auto border-b border-line [scrollbar-width:none]",
        className,
      )}
      {...props}
    />
  );
}

export function TabsTrigger({
  className,
  ...props
}: ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      className={cn(
        "relative -mb-px inline-flex h-10 shrink-0 cursor-pointer items-center gap-1.5 text-small font-medium whitespace-nowrap text-fg-muted",
        "after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:rounded-full after:bg-transparent after:content-['']",
        "hover:text-fg data-[state=active]:text-fg data-[state=active]:after:bg-primary",
        "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-signal disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

export function TabsContent({
  className,
  ...props
}: ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      className={cn("focus-visible:-outline-offset-2", className)}
      {...props}
    />
  );
}
