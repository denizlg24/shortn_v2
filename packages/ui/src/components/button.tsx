"use client";

import type { VariantProps } from "class-variance-authority";
import { LoaderCircle } from "lucide-react";
import { Slot } from "radix-ui";
import type { ComponentProps, MouseEvent, ReactNode } from "react";
import { cn } from "../lib/cn";
import { buttonVariants } from "./button-variants";
import { KeyboardHint, type KeyboardHintProps } from "./keyboard-hint";
import { Tooltip } from "./tooltip";

export interface ButtonProps
  extends ComponentProps<"button">, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
  /** Keeps the button focusable and explains why it can't be used (e.g. viewer role). */
  disabledReason?: ReactNode;
  shortcut?: KeyboardHintProps["keys"];
  /** Tooltip shown on hover/focus; icon-only buttons should always set this. */
  tooltip?: ReactNode;
}

export function Button({
  className,
  variant,
  size,
  asChild = false,
  loading = false,
  disabledReason,
  shortcut,
  tooltip,
  disabled,
  onClick,
  children,
  type = "button",
  ...props
}: ButtonProps) {
  const blocked = Boolean(disabledReason) || loading;
  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    if (blocked) {
      event.preventDefault();
      return;
    }
    onClick?.(event);
  };
  const hintTone =
    variant === "primary" || variant === "danger" ? "inverse" : "default";
  const Component = asChild ? Slot.Root : "button";

  const button = (
    <Component
      type={asChild ? undefined : type}
      className={cn(buttonVariants({ variant, size }), className)}
      disabled={disabled}
      aria-disabled={blocked || undefined}
      aria-busy={loading || undefined}
      onClick={handleClick}
      {...props}
    >
      {asChild ? (
        children
      ) : (
        <>
          {loading ? (
            <LoaderCircle aria-hidden className="animate-spin" />
          ) : null}
          {children}
          {shortcut && !tooltip ? (
            <KeyboardHint
              keys={shortcut}
              tone={hintTone}
              className="-mr-1 ml-0.5"
            />
          ) : null}
        </>
      )}
    </Component>
  );

  const tip = disabledReason ?? tooltip;
  if (!tip) return button;
  return (
    <Tooltip
      content={tip}
      {...(shortcut && !disabledReason ? { shortcut } : {})}
    >
      {button}
    </Tooltip>
  );
}
