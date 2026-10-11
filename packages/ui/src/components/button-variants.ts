// Plain styling, kept apart from the client Button so server components can
// style links as buttons.
import { cva } from "class-variance-authority";

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
