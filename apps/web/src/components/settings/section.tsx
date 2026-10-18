import { cn } from "@shortn/ui";
import {
  CircleAlert,
  CircleCheck,
  Info,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";
import { useId, type ReactNode } from "react";

/** One settings page: its heading, then sections split by hairlines. */
export function SettingsPage({
  title,
  description,
  children,
}: {
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col">
      <div className="flex flex-col gap-1 pb-8">
        <h2 className="text-title font-semibold tracking-[-0.015em]">
          {title}
        </h2>
        {description ? (
          <p className="text-body text-pretty text-fg-muted">{description}</p>
        ) : null}
      </div>
      <div className="flex flex-col [&>*]:border-t [&>*]:border-line [&>*]:py-8 [&>*:last-child]:pb-0">
        {children}
      </div>
    </div>
  );
}

export function SettingsSection({
  id,
  title,
  description,
  aside,
  tone = "default",
  wide = false,
  children,
}: {
  /** Fragment target, e.g. `#plans`. */
  id?: string;
  title: ReactNode;
  description?: ReactNode;
  /** Rendered at the end of the heading row, e.g. a section-level action. */
  aside?: ReactNode;
  tone?: "default" | "danger";
  /** Tables may use the full column; forms stay at 560px (12 §Settings). */
  wide?: boolean;
  children?: ReactNode;
}) {
  const headingId = useId();
  return (
    <section
      id={id}
      aria-labelledby={headingId}
      className="scroll-mt-page-header"
    >
      <div className={cn("flex flex-col gap-5", !wide && "max-w-140")}>
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
          <div className="flex min-w-0 flex-1 basis-64 flex-col gap-1">
            <h3
              id={headingId}
              className={cn(
                "text-emphasis font-semibold tracking-[-0.01em]",
                tone === "danger" && "text-danger",
              )}
            >
              {title}
            </h3>
            {description ? (
              <p className="text-small text-pretty text-fg-muted">
                {description}
              </p>
            ) : null}
          </div>
          {aside ? <div className="flex shrink-0 gap-2">{aside}</div> : null}
        </div>
        {children}
      </div>
    </section>
  );
}

const toneIcon: Record<NoticeTone, LucideIcon> = {
  neutral: Info,
  success: CircleCheck,
  warning: TriangleAlert,
  danger: CircleAlert,
};

const toneColor: Record<NoticeTone, string> = {
  neutral: "text-signal",
  success: "text-success",
  warning: "text-warning",
  danger: "text-danger",
};

export type NoticeTone = "neutral" | "success" | "warning" | "danger";

/** A one-line status with an optional inline action; never a boxed banner. */
export function Notice({
  tone = "neutral",
  live,
  action,
  className,
  children,
}: {
  tone?: NoticeTone;
  /** `status` for results the user just caused, `alert` for blocking problems. */
  live?: "status" | "alert";
  action?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  const Icon = toneIcon[tone];
  return (
    <div
      role={live}
      className={cn("flex items-start gap-2.5 text-small", className)}
    >
      <Icon
        aria-hidden
        className={cn("mt-px size-4 shrink-0", toneColor[tone])}
      />
      <div className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-3 gap-y-1">
        <p className="min-w-0 text-pretty text-fg">{children}</p>
        {action}
      </div>
    </div>
  );
}

export const textAction =
  "cursor-pointer text-small font-medium text-signal underline-offset-[3px] hover:underline disabled:cursor-not-allowed disabled:opacity-50";
