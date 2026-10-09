import { cva, type VariantProps } from "class-variance-authority";
import { LoaderCircle } from "lucide-react";
import { Slot } from "radix-ui";
import type { ComponentProps, MouseEvent, ReactNode } from "react";
import { cn } from "../lib/cn";
import { KeyboardHint, type KeyboardHintProps } from "./keyboard-hint";
import { Tooltip } from "./tooltip";

export const buttonVariants = cva(
  [
    "relative inline-flex shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-control font-medium whitespace-nowrap select-none",
    "transition-[background-color,border-color,color] duration-(--motion-fast)",
    "disabled:cursor-not-allowed disabled:opacity-50 aria-disabled:cursor-not-allowed aria-disabled:opacity-50",
    "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  ],
  {
    variants: {
      variant: {
        primary:
          "bg-primary text-primary-fg not-aria-disabled:hover:bg-primary-hover",
        secondary:
          "border border-line-strong bg-field text-fg not-aria-disabled:hover:border-fg-subtle/60 not-aria-disabled:hover:bg-bg-subtle",
        ghost:
          "text-fg-muted not-aria-disabled:hover:bg-bg-muted not-aria-disabled:hover:text-fg aria-expanded:bg-bg-muted aria-expanded:text-fg",
        danger:
          "bg-danger text-danger-fg not-aria-disabled:hover:bg-danger-hover",
        dangerGhost: "text-danger not-aria-disabled:hover:bg-danger/10",
      },
      size: {
        sm: "h-7 px-2 text-small",
        md: "h-8 px-3 text-small",
        lg: "h-9 px-3.5 text-body",
        "icon-sm": "size-7 text-small",
        "icon-md": "size-8 text-small",
      },
    },
    defaultVariants: { variant: "secondary", size: "md" },
  },
);

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
