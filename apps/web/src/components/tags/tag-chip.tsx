import { tagColorOf, type TagColor } from "@shortn/core/tag-options";
import { cn, Tooltip } from "@shortn/ui";

// Static class names so Tailwind generates every swatch.
export const tagDotClass: Record<TagColor, string> = {
  slate: "bg-tag-slate",
  blue: "bg-tag-blue",
  teal: "bg-tag-teal",
  violet: "bg-tag-violet",
  magenta: "bg-tag-magenta",
  ochre: "bg-tag-ochre",
  rust: "bg-tag-rust",
};

export function TagDot({
  color,
  className,
}: {
  color: TagColor | string | null | undefined;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-block size-2 shrink-0 rounded-full",
        tagDotClass[tagColorOf(color)],
        className,
      )}
    />
  );
}

const chip =
  "inline-flex h-5 max-w-32 min-w-0 items-center gap-1.5 rounded-chip bg-fg/6 px-1.5 text-meta text-fg-muted";

export function TagChip({
  name,
  color,
  className,
}: {
  name: string;
  color: TagColor | string | null | undefined;
  className?: string;
}) {
  return (
    <span className={cn(chip, className)} title={name}>
      <TagDot color={color} className="size-1.5" />
      <span className="truncate">{name}</span>
    </span>
  );
}

/** A bounded row of chips; the rest collapse into a "+N" chip with a tooltip. */
export function TagChipList({
  tags,
  colors,
  max = 3,
  moreLabel,
  className,
}: {
  tags: { id: string; name: string }[];
  colors: Record<string, TagColor>;
  max?: number;
  moreLabel: (count: number) => string;
  className?: string;
}) {
  if (!tags.length) return null;
  const shown = tags.slice(0, max),
    hidden = tags.slice(max);
  return (
    <span
      className={cn("flex min-w-0 flex-wrap items-center gap-1", className)}
    >
      {shown.map((tag) => (
        <TagChip
          key={tag.id}
          name={tag.name}
          color={colors[tag.name.toLowerCase()]}
        />
      ))}
      {hidden.length ? (
        <Tooltip
          content={
            <span className="line-clamp-5">
              {hidden.map((tag) => tag.name).join(", ")}
            </span>
          }
        >
          <span tabIndex={0} className={cn(chip, "font-mono tabular-nums")}>
            {moreLabel(hidden.length)}
            <span className="sr-only">
              {`: ${hidden.map((tag) => tag.name).join(", ")}`}
            </span>
          </span>
        </Tooltip>
      ) : null}
    </span>
  );
}
