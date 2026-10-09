import { Command as CommandPrimitive } from "cmdk";
import { Search } from "lucide-react";
import { Dialog as DialogPrimitive } from "radix-ui";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "../lib/cn";
import { DialogScrim } from "./dialog";
import { KeyboardHint, type KeyboardHintProps } from "./keyboard-hint";

export function Command({
  className,
  ...props
}: ComponentProps<typeof CommandPrimitive>) {
  return (
    <CommandPrimitive
      className={cn(
        "flex h-full w-full flex-col overflow-hidden text-fg",
        className,
      )}
      {...props}
    />
  );
}

export function CommandInput({
  className,
  frameClassName,
  trailing,
  ...props
}: ComponentProps<typeof CommandPrimitive.Input> & {
  trailing?: ReactNode;
  frameClassName?: string;
}) {
  return (
    <div
      className={cn(
        "flex h-12 shrink-0 items-center gap-2.5 border-b border-line px-4",
        frameClassName,
      )}
    >
      <Search aria-hidden className="size-4 shrink-0 text-fg-subtle" />
      <CommandPrimitive.Input
        className={cn(
          "h-full min-w-0 flex-1 bg-transparent text-body outline-none placeholder:text-fg-subtle",
          className,
        )}
        {...props}
      />
      {trailing}
    </div>
  );
}

export function CommandList({
  className,
  ...props
}: ComponentProps<typeof CommandPrimitive.List>) {
  return (
    <CommandPrimitive.List
      className={cn(
        "max-h-[min(420px,56vh)] scroll-py-1.5 overflow-y-auto overscroll-contain p-1.5",
        className,
      )}
      {...props}
    />
  );
}

export function CommandEmpty({
  className,
  ...props
}: ComponentProps<typeof CommandPrimitive.Empty>) {
  return (
    <CommandPrimitive.Empty
      className={cn(
        "px-3 py-8 text-center text-small text-fg-muted",
        className,
      )}
      {...props}
    />
  );
}

export function CommandGroup({
  className,
  ...props
}: ComponentProps<typeof CommandPrimitive.Group>) {
  return (
    <CommandPrimitive.Group
      className={cn(
        "[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:pt-2.5 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:text-meta [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-fg-subtle",
        className,
      )}
      {...props}
    />
  );
}

export function CommandSeparator({
  className,
  ...props
}: ComponentProps<typeof CommandPrimitive.Separator>) {
  return (
    <CommandPrimitive.Separator
      className={cn("-mx-1.5 my-1.5 h-px bg-line", className)}
      {...props}
    />
  );
}

export function CommandItem({
  className,
  icon,
  shortcut,
  shortcutSequence,
  meta,
  children,
  ...props
}: ComponentProps<typeof CommandPrimitive.Item> & {
  icon?: ReactNode;
  shortcut?: KeyboardHintProps["keys"];
  shortcutSequence?: boolean;
  meta?: ReactNode;
}) {
  return (
    <CommandPrimitive.Item
      className={cn(
        "flex h-9 cursor-pointer items-center gap-2.5 rounded-control px-2 text-small outline-none select-none",
        "data-[selected=true]:bg-bg-muted data-[disabled=true]:cursor-not-allowed data-[disabled=true]:opacity-50",
        "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 [&_svg:not([class*='text-'])]:text-fg-muted",
        className,
      )}
      {...props}
    >
      {icon}
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {meta ? (
        <span className="max-w-[45%] shrink-0 truncate text-meta text-fg-subtle">
          {meta}
        </span>
      ) : null}
      {shortcut ? (
        <KeyboardHint
          keys={shortcut}
          {...(shortcutSequence ? { sequence: true } : {})}
        />
      ) : null}
    </CommandPrimitive.Item>
  );
}

export interface CommandDialogProps extends ComponentProps<
  typeof DialogPrimitive.Root
> {
  title: string;
  footer?: ReactNode;
  commandProps?: ComponentProps<typeof CommandPrimitive>;
}

export function CommandDialog({
  title,
  footer,
  commandProps,
  children,
  ...props
}: CommandDialogProps) {
  return (
    <DialogPrimitive.Root {...props}>
      <DialogPrimitive.Portal>
        <DialogScrim />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          className={cn(
            "fixed top-[14vh] left-1/2 z-50 flex w-[calc(100vw-24px)] max-w-160 -translate-x-1/2 flex-col overflow-hidden rounded-overlay border border-line bg-overlay shadow-overlay outline-none",
            "origin-top data-[state=open]:animate-overlay-in data-[state=closed]:animate-overlay-out",
          )}
        >
          <DialogPrimitive.Title className="sr-only">
            {title}
          </DialogPrimitive.Title>
          <Command loop {...commandProps}>
            {children}
          </Command>
          {footer ? (
            <div className="flex h-9 shrink-0 items-center gap-4 border-t border-line px-4 text-meta text-fg-subtle">
              {footer}
            </div>
          ) : null}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
