import { CircleAlert, CircleCheck } from "lucide-react";
import { Toaster as Sonner, toast, type ToasterProps } from "sonner";

export { toast };

export function Toaster(props: ToasterProps) {
  return (
    <Sonner
      position="bottom-right"
      gap={8}
      offset={16}
      mobileOffset={12}
      icons={{
        success: <CircleCheck aria-hidden className="size-4 text-success" />,
        error: <CircleAlert aria-hidden className="size-4 text-danger" />,
      }}
      toastOptions={{
        unstyled: true,
        classNames: {
          toast:
            "group flex w-(--width) items-start gap-2.5 rounded-overlay border border-line bg-overlay px-3.5 py-3 text-small text-fg shadow-overlay",
          title: "font-medium text-pretty",
          description: "mt-0.5 text-meta text-fg-muted text-pretty",
          icon: "mt-0.5 flex size-4 shrink-0 items-center",
          content: "min-w-0 flex-1",
          actionButton:
            "ml-2 -my-1 h-7 shrink-0 cursor-pointer rounded-control px-2 text-small font-medium text-signal hover:bg-signal-wash",
          cancelButton:
            "ml-1 -my-1 h-7 shrink-0 cursor-pointer rounded-control px-2 text-small text-fg-muted hover:bg-bg-muted",
          closeButton: "border-line bg-overlay text-fg-muted",
        },
      }}
      {...props}
    />
  );
}
