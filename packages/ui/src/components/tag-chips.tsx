import { useUILocale } from "../i18n/provider";
import { cn } from "../lib/cn";
import { Tooltip } from "./tooltip";

const chip =
  "inline-flex h-5 max-w-32 min-w-[4ch] items-center rounded-chip bg-fg/6 px-1.5 py-0.5 text-meta leading-4 text-fg-muted";

export interface TagChipsProps {
  tags: string[];
  /** Maximum chips before collapsing the rest into a "+N" chip. */
  max?: number;
  className?: string;
}

export function TagChips({ tags, max = 2, className }: TagChipsProps) {
  const { t } = useUILocale();
  if (tags.length === 0) return null;
  const visible = tags.slice(0, max);
  const hidden = tags.slice(max);
  return (
    <span
      className={cn(
        "flex min-w-0 items-center gap-1 overflow-hidden",
        className,
      )}
    >
      {visible.map((tag, index) => (
        <span key={tag} className={cn(chip, index === 0 && "shrink-0")}>
          <span className="truncate">{tag}</span>
        </span>
      ))}
      {hidden.length > 0 ? (
        <Tooltip
          content={<span className="line-clamp-5">{hidden.join(", ")}</span>}
        >
          <span className={cn(chip, "shrink-0 font-mono tabular-nums")}>
            {t.moreTags(hidden.length)}
          </span>
        </Tooltip>
      ) : null}
    </span>
  );
}
