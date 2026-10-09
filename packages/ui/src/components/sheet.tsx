import { X } from "lucide-react";
import { Dialog as DialogPrimitive } from "radix-ui";
import type { ComponentProps, ReactNode } from "react";
import { useUILocale } from "../i18n/provider";
import { cn } from "../lib/cn";
import { Button } from "./button";
import { DialogScrim } from "./dialog";

export const Sheet = DialogPrimitive.Root;
export const SheetTrigger = DialogPrimitive.Trigger;
export const SheetClose = DialogPrimitive.Close;

export interface SheetContentProps extends ComponentProps<
  typeof DialogPrimitive.Content
> {
  side?: "right" | "left";
}

export function SheetContent({
  className,
  children,
  side = "right",
  ...props
}: SheetContentProps) {
  return (
    <DialogPrimitive.Portal>
      <DialogScrim />
      <DialogPrimitive.Content
        className={cn(
          "fixed inset-y-0 z-50 flex w-full flex-col bg-bg text-fg shadow-overlay outline-none",
          "data-[state=open]:animate-sheet-in data-[state=closed]:animate-sheet-out",
          side === "right"
            ? "right-0 md:border-l md:border-line"
            : "left-0 md:border-r md:border-line [--sheet-dir:-1]",
          side === "right" && "md:w-[clamp(480px,42vw,640px)]",
          side === "left" && "max-w-[min(320px,85vw)]",
          className,
        )}
        {...props}
      >
        {children}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

export function SheetHeader({
  className,
  children,
  closable = true,
}: {
  className?: string;
  children: ReactNode;
  closable?: boolean;
}) {
  const { t } = useUILocale();
  return (
    <div
      className={cn(
        "flex shrink-0 items-start gap-3 px-6 pt-5 pb-4 max-md:px-4",
        className,
      )}
    >
      <div className="flex min-w-0 flex-1 flex-col gap-1">{children}</div>
      {closable ? (
        <DialogPrimitive.Close asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            tooltip={t.close}
            shortcut="esc"
            aria-label={t.close}
            className="-mt-0.5 -mr-1.5"
          >
            <X aria-hidden />
          </Button>
        </DialogPrimitive.Close>
      ) : null}
    </div>
  );
}

export function SheetTitle({
  className,
  ...props
}: ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      className={cn(
        "text-emphasis font-semibold tracking-[-0.01em]",
        className,
      )}
      {...props}
    />
  );
}

export function SheetDescription({
  className,
  ...props
}: ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      className={cn("text-small text-fg-muted", className)}
      {...props}
    />
  );
}

export function SheetBody({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "min-h-0 flex-1 overflow-y-auto px-6 pb-6 max-md:px-4",
        className,
      )}
      {...props}
    />
  );
}

export function SheetFooter({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-end gap-2 border-t border-line px-6 py-3 max-md:px-4",
        className,
      )}
      {...props}
    />
  );
}
