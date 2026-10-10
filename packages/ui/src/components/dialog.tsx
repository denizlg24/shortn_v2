import { X } from "lucide-react";
import { Dialog as DialogPrimitive } from "radix-ui";
import type { ComponentProps, ReactNode } from "react";
import { useUILocale } from "../i18n/provider";
import { cn } from "../lib/cn";
import { Button } from "./button";

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

export function DialogScrim({
  className,
  ...props
}: ComponentProps<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay
      className={cn(
        "fixed inset-0 z-50 bg-scrim data-[state=open]:animate-fade-in data-[state=closed]:animate-fade-out",
        className,
      )}
      {...props}
    />
  );
}

export function DialogContent({
  className,
  children,
  ...props
}: ComponentProps<typeof DialogPrimitive.Content>) {
  return (
    <DialogPrimitive.Portal>
      <DialogScrim />
      <DialogPrimitive.Content
        className={cn(
          "fixed top-[18vh] left-1/2 z-50 flex w-[calc(100vw-32px)] max-w-110 -translate-x-1/2 flex-col gap-4 rounded-overlay border border-line bg-overlay p-5 text-fg shadow-overlay outline-none",
          "data-[state=open]:animate-overlay-in data-[state=closed]:animate-overlay-out",
          className,
        )}
        {...props}
      >
        {children}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

export function DialogHeader({
  title,
  description,
}: {
  title: ReactNode;
  description?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <DialogPrimitive.Title className="text-emphasis font-semibold tracking-[-0.01em] text-pretty">
        {title}
      </DialogPrimitive.Title>
      {description ? (
        <DialogPrimitive.Description className="text-body text-pretty text-fg-muted">
          {description}
        </DialogPrimitive.Description>
      ) : null}
    </div>
  );
}

export function DialogFooter({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "mt-1 flex flex-wrap items-center justify-end gap-2",
        className,
      )}
      {...props}
    />
  );
}

export function DialogCloseButton({ className }: { className?: string }) {
  const { t } = useUILocale();
  return (
    <DialogPrimitive.Close asChild>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={t.close}
        className={cn("absolute top-3 right-3", className)}
      >
        <X aria-hidden />
      </Button>
    </DialogPrimitive.Close>
  );
}
