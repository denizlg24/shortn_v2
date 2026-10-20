"use client";

import { tagColors, type TagColor } from "@shortn/core/tag-options";
import { cn, Popover, PopoverContent, PopoverTrigger } from "@shortn/ui";
import { Check } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { setTagColorAction } from "@/server/actions/tags";
import { TagDot, tagDotClass } from "./tag-chip";

/** The fixed palette as native radios, so it works in forms and by keyboard. */
export function TagColorSwatches({
  value,
  onChange,
  name,
  legend,
  disabled = false,
}: {
  value: TagColor;
  onChange: (color: TagColor) => void;
  name: string;
  legend: string;
  disabled?: boolean;
}) {
  const t = useTranslations("tags.colors");
  return (
    <fieldset disabled={disabled} className="min-w-0">
      <legend className="sr-only">{legend}</legend>
      <div className="flex flex-wrap gap-2">
        {tagColors.map((color) => (
          <label
            key={color}
            className="relative cursor-pointer"
            title={t(color)}
          >
            <input
              type="radio"
              name={name}
              value={color}
              checked={value === color}
              onChange={() => onChange(color)}
              className="peer sr-only"
            />
            <span className="sr-only">{t(color)}</span>
            <span
              aria-hidden
              className={cn(
                "grid size-6 place-items-center rounded-full text-bg ring-offset-2 ring-offset-overlay transition-shadow duration-(--motion-fast)",
                "peer-checked:ring-2 peer-checked:ring-fg-muted peer-focus-visible:outline-2 peer-focus-visible:outline-offset-4 peer-focus-visible:outline-signal",
                tagDotClass[color],
              )}
            >
              {value === color ? (
                <Check className="size-3.5" strokeWidth={3} />
              ) : null}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/** A tag's dot; for editors it opens the palette and saves on pick. */
export function TagColorButton({
  workspace,
  id,
  name,
  color,
  editable,
}: {
  workspace: string;
  id: string;
  name: string;
  color: TagColor;
  editable: boolean;
}) {
  const t = useTranslations("tags");
  const router = useRouter();
  const groupName = useId();
  const [open, setOpen] = useState(false);
  const [shown, setShown] = useState(color);
  const [synced, setSynced] = useState(color);
  if (synced !== color) {
    setSynced(color);
    setShown(color);
  }
  const [failed, setFailed] = useState(false);
  const [pending, startTransition] = useTransition();
  if (!editable) return <TagDot color={color} className="m-1" />;
  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setFailed(false);
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={t("colorFor", { tag: name })}
          className="grid size-6 shrink-0 cursor-pointer place-items-center rounded-control hover:bg-bg-muted"
        >
          <TagDot color={shown} className="size-2.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-3">
        <p className="mb-2 text-meta font-medium text-fg-muted">{t("color")}</p>
        <TagColorSwatches
          name={groupName}
          legend={t("colorFor", { tag: name })}
          value={shown}
          disabled={pending}
          onChange={(next) => {
            const previous = shown;
            setShown(next);
            startTransition(async () => {
              const result = await setTagColorAction(workspace, id, next);
              if (!result.ok) {
                setShown(previous);
                setFailed(true);
                return;
              }
              setOpen(false);
              router.refresh();
            });
          }}
        />
        {failed ? (
          <p role="alert" className="mt-2 max-w-56 text-meta text-danger">
            {t("colorFailed")}
          </p>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}
