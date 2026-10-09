import { Check, Minus } from "lucide-react";
import {
  Checkbox as CheckboxPrimitive,
  Switch as SwitchPrimitive,
} from "radix-ui";
import type { ComponentProps } from "react";
import { cn } from "../lib/cn";

export function Checkbox({
  className,
  ...props
}: ComponentProps<typeof CheckboxPrimitive.Root>) {
  return (
    <CheckboxPrimitive.Root
      className={cn(
        "peer relative grid size-4 shrink-0 cursor-pointer place-items-center rounded-chip border border-line-strong bg-field text-signal-fg",
        "before:absolute before:-inset-1 before:content-['']",
        "hover:border-fg-subtle focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal",
        "data-[state=checked]:border-signal data-[state=checked]:bg-signal data-[state=indeterminate]:border-signal data-[state=indeterminate]:bg-signal",
        "disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-danger",
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator className="grid place-items-center">
        {props.checked === "indeterminate" ? (
          <Minus aria-hidden className="size-3" strokeWidth={3} />
        ) : (
          <Check aria-hidden className="size-3" strokeWidth={3} />
        )}
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}

export function Switch({
  className,
  ...props
}: ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      className={cn(
        "peer relative inline-flex h-4 w-7 shrink-0 cursor-pointer items-center rounded-full bg-line-strong p-0.5",
        "before:absolute before:-inset-x-0.5 before:-inset-y-1 before:content-['']",
        "transition-colors duration-(--motion-fast) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal",
        "data-[state=checked]:bg-signal disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        className={cn(
          "pointer-events-none block size-3 rounded-full bg-bg dark:bg-fg",
          "transition-transform duration-(--motion-fast) ease-overlay data-[state=checked]:translate-x-3 dark:data-[state=checked]:bg-signal-fg",
        )}
      />
    </SwitchPrimitive.Root>
  );
}
