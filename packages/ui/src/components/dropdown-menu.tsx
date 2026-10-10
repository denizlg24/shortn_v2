import { Check, ChevronRight, Dot } from "lucide-react";
import { DropdownMenu as MenuPrimitive } from "radix-ui";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "../lib/cn";
import { KeyboardHint, type KeyboardHintProps } from "./keyboard-hint";
import {
  menuItem,
  menuLabel,
  menuSeparator,
  overlaySurface,
} from "./overlay-styles";

export const DropdownMenu = MenuPrimitive.Root;
export const DropdownMenuTrigger = MenuPrimitive.Trigger;
export const DropdownMenuGroup = MenuPrimitive.Group;
export const DropdownMenuSub = MenuPrimitive.Sub;
export const DropdownMenuRadioGroup = MenuPrimitive.RadioGroup;

export function DropdownMenuContent({
  className,
  sideOffset = 4,
  align = "start",
  ...props
}: ComponentProps<typeof MenuPrimitive.Content>) {
  return (
    <MenuPrimitive.Portal>
      <MenuPrimitive.Content
        sideOffset={sideOffset}
        align={align}
        collisionPadding={8}
        className={cn(
          overlaySurface,
          "max-h-(--radix-dropdown-menu-content-available-height) min-w-48 origin-(--radix-dropdown-menu-content-transform-origin) overflow-y-auto p-1",
          className,
        )}
        {...props}
      />
    </MenuPrimitive.Portal>
  );
}

interface ItemExtras {
  icon?: ReactNode;
  shortcut?: KeyboardHintProps["keys"];
  tone?: "default" | "danger";
}

export function DropdownMenuItem({
  className,
  icon,
  shortcut,
  tone = "default",
  children,
  ...props
}: ComponentProps<typeof MenuPrimitive.Item> & ItemExtras) {
  return (
    <MenuPrimitive.Item
      className={cn(
        menuItem,
        tone === "danger" &&
          "text-danger data-highlighted:bg-danger/10 [&_svg]:text-danger!",
        className,
      )}
      {...props}
    >
      {icon}
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {shortcut ? (
        <KeyboardHint keys={shortcut} tone="plain" className="ml-4" />
      ) : null}
    </MenuPrimitive.Item>
  );
}

export function DropdownMenuCheckboxItem({
  className,
  children,
  ...props
}: ComponentProps<typeof MenuPrimitive.CheckboxItem>) {
  return (
    <MenuPrimitive.CheckboxItem
      className={cn(menuItem, "pl-8", className)}
      {...props}
    >
      <MenuPrimitive.ItemIndicator className="absolute left-2 flex items-center">
        <Check aria-hidden className="text-fg!" />
      </MenuPrimitive.ItemIndicator>
      <span className="min-w-0 flex-1 truncate">{children}</span>
    </MenuPrimitive.CheckboxItem>
  );
}

export function DropdownMenuRadioItem({
  className,
  children,
  ...props
}: ComponentProps<typeof MenuPrimitive.RadioItem>) {
  return (
    <MenuPrimitive.RadioItem
      className={cn(menuItem, "pl-8", className)}
      {...props}
    >
      <MenuPrimitive.ItemIndicator className="absolute left-1.5 flex items-center">
        <Dot aria-hidden className="size-5 text-fg!" strokeWidth={6} />
      </MenuPrimitive.ItemIndicator>
      <span className="min-w-0 flex-1 truncate">{children}</span>
    </MenuPrimitive.RadioItem>
  );
}

export function DropdownMenuLabel({
  className,
  ...props
}: ComponentProps<typeof MenuPrimitive.Label>) {
  return (
    <MenuPrimitive.Label className={cn(menuLabel, className)} {...props} />
  );
}

export function DropdownMenuSeparator({
  className,
  ...props
}: ComponentProps<typeof MenuPrimitive.Separator>) {
  return (
    <MenuPrimitive.Separator
      className={cn(menuSeparator, className)}
      {...props}
    />
  );
}

export function DropdownMenuSubTrigger({
  className,
  icon,
  children,
  ...props
}: ComponentProps<typeof MenuPrimitive.SubTrigger> & { icon?: ReactNode }) {
  return (
    <MenuPrimitive.SubTrigger
      className={cn(menuItem, "data-[state=open]:bg-bg-muted", className)}
      {...props}
    >
      {icon}
      <span className="min-w-0 flex-1 truncate">{children}</span>
      <ChevronRight aria-hidden className="ml-auto" />
    </MenuPrimitive.SubTrigger>
  );
}

export function DropdownMenuSubContent({
  className,
  ...props
}: ComponentProps<typeof MenuPrimitive.SubContent>) {
  return (
    <MenuPrimitive.Portal>
      <MenuPrimitive.SubContent
        collisionPadding={8}
        className={cn(
          overlaySurface,
          "min-w-44 origin-(--radix-dropdown-menu-content-transform-origin) p-1",
          className,
        )}
        {...props}
      />
    </MenuPrimitive.Portal>
  );
}
