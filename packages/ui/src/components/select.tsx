import { Check, ChevronDown } from "lucide-react";
import { Select as SelectPrimitive } from "radix-ui";
import type { ComponentProps } from "react";
import { cn } from "../lib/cn";
import { fieldFrame } from "./input";
import {
  menuItem,
  menuLabel,
  menuSeparator,
  overlaySurface,
} from "./overlay-styles";

export const Select = SelectPrimitive.Root;
export const SelectGroup = SelectPrimitive.Group;
export const SelectValue = SelectPrimitive.Value;

export function SelectTrigger({
  className,
  children,
  size = "md",
  ...props
}: ComponentProps<typeof SelectPrimitive.Trigger> & { size?: "sm" | "md" }) {
  return (
    <SelectPrimitive.Trigger
      className={cn(
        fieldFrame,
        "flex w-full cursor-pointer items-center justify-between gap-2 px-2.5 py-1 text-left text-small outline-none",
        "focus-visible:border-signal focus-visible:ring-1 focus-visible:ring-signal data-placeholder:text-fg-subtle",
        "aria-invalid:border-danger disabled:cursor-not-allowed disabled:opacity-50 [&>span]:truncate",
        size === "sm" ? "h-7" : "h-8",
        className,
      )}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon asChild>
        <ChevronDown aria-hidden className="size-4 shrink-0 text-fg-subtle" />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  );
}

export function SelectContent({
  className,
  children,
  position = "popper",
  ...props
}: ComponentProps<typeof SelectPrimitive.Content>) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content
        position={position}
        sideOffset={4}
        collisionPadding={8}
        className={cn(
          overlaySurface,
          "max-h-(--radix-select-content-available-height) min-w-(--radix-select-trigger-width) origin-(--radix-select-content-transform-origin) overflow-hidden",
          className,
        )}
        {...props}
      >
        <SelectPrimitive.Viewport className="p-1">
          {children}
        </SelectPrimitive.Viewport>
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  );
}

export function SelectItem({
  className,
  children,
  ...props
}: ComponentProps<typeof SelectPrimitive.Item>) {
  return (
    <SelectPrimitive.Item
      className={cn(menuItem, "pr-8", className)}
      {...props}
    >
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
      <SelectPrimitive.ItemIndicator className="absolute right-2 flex items-center">
        <Check aria-hidden className="text-fg" />
      </SelectPrimitive.ItemIndicator>
    </SelectPrimitive.Item>
  );
}

export function SelectLabel({
  className,
  ...props
}: ComponentProps<typeof SelectPrimitive.Label>) {
  return (
    <SelectPrimitive.Label className={cn(menuLabel, className)} {...props} />
  );
}

export function SelectSeparator({
  className,
  ...props
}: ComponentProps<typeof SelectPrimitive.Separator>) {
  return (
    <SelectPrimitive.Separator
      className={cn(menuSeparator, className)}
      {...props}
    />
  );
}
