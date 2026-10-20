"use client";

import {
  Button,
  cn,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@shortn/ui";
import { ChevronDown, X } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  type ReactNode,
} from "react";

interface PageSelection {
  enabled: boolean;
  eligible: number;
  onPage: number;
  setPage: (checked: boolean) => void;
}

export const PageSelectionContext = createContext<PageSelection | null>(null);

/** "Select this page" for a table header or grid toolbar inside a selection form. */
export function SelectPageCheckbox({
  label,
  showLabel = false,
}: {
  label: string;
  showLabel?: boolean;
}) {
  const selection = useContext(PageSelectionContext);
  const input = useRef<HTMLInputElement>(null);
  const eligible = selection?.eligible ?? 0,
    onPage = selection?.onPage ?? 0;
  useEffect(() => {
    if (input.current)
      input.current.indeterminate = onPage > 0 && onPage < eligible;
  }, [onPage, eligible]);
  if (!selection?.enabled) return null;
  const box = (
    <input
      ref={input}
      type="checkbox"
      aria-label={showLabel ? undefined : label}
      disabled={!eligible}
      checked={eligible > 0 && onPage === eligible}
      onChange={(event) => selection.setPage(event.target.checked)}
      className="size-4 accent-[var(--color-signal)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal"
    />
  );
  return showLabel ? (
    <label className="inline-flex items-center gap-2 text-small text-fg-muted">
      {box}
      {label}
    </label>
  ) : (
    box
  );
}

export interface SelectionAction {
  label: string;
  tone?: "default" | "danger";
  onSelect: () => void;
  disabled?: boolean;
}

/**
 * The bulk bar only exists while something is selected: it floats at the
 * bottom of the content column (above the mobile tab bar) and settles
 * after the list when scrolled to the end.
 */
export function SelectionBar({
  count,
  limit,
  status,
  actions,
  onClear,
  busy = false,
}: {
  count: number;
  limit: number;
  status: ReactNode;
  actions: SelectionAction[];
  onClear: () => void;
  busy?: boolean;
}) {
  const t = useTranslations("page.selection");
  if (count < 1) return null;
  return (
    <div
      role="region"
      aria-label={t("bar")}
      className={cn(
        "sticky bottom-4 z-20 mt-4 flex min-w-0 items-center gap-3 rounded-overlay border border-line bg-overlay py-2 pr-2 pl-3.5 shadow-overlay animate-overlay-in",
        "max-md:bottom-[calc(4.5rem+env(safe-area-inset-bottom))]",
      )}
    >
      <div className="flex min-w-0 flex-1 flex-col sm:flex-row sm:items-baseline sm:gap-2">
        <span role="status" className="text-small font-medium tabular-nums">
          {status}
        </span>
        <span className="truncate text-meta text-fg-muted">
          {t("maximum", { limit })}
        </span>
      </div>
      <div className="flex shrink-0 items-center gap-1.5 max-sm:hidden">
        {actions.map((action) => (
          <ActionButton key={action.label} action={action} busy={busy} />
        ))}
      </div>
      {actions.length ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="secondary"
              size="sm"
              disabled={busy}
              className="sm:hidden"
            >
              {t("actions")}
              <ChevronDown aria-hidden />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-52">
            {actions.map((action) => (
              <DropdownMenuItem
                key={action.label}
                tone={action.tone ?? "default"}
                disabled={busy || Boolean(action.disabled)}
                onSelect={action.onSelect}
              >
                {action.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={t("clear")}
        tooltip={t("clear")}
        disabled={busy}
        onClick={onClear}
      >
        <X aria-hidden />
      </Button>
    </div>
  );
}

function ActionButton({
  action,
  busy,
}: {
  action: SelectionAction;
  busy: boolean;
}) {
  return (
    <Button
      variant={action.tone === "danger" ? "dangerGhost" : "secondary"}
      size="sm"
      disabled={busy || Boolean(action.disabled)}
      onClick={action.onSelect}
    >
      {action.label}
    </Button>
  );
}
