"use client";

import type { LinkView } from "@shortn/core";
import { announce, Button, cn, Input, parseDestination } from "@shortn/ui";
import { ArrowDown, ArrowUp, GripVertical, Plus, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import { LinkPicker } from "../editor/link-picker";
import type { LinkItem } from "./bio-draft";
import { maxBioLinks } from "./bio-rules";
import { BioSection, type SaveState } from "./bio-section";

export function BioLinksSection({
  workspace,
  linkDomain,
  items,
  onChange,
  dirty,
  state,
  viewerReason,
  onSave,
}: {
  workspace: string;
  /** Short link domain, for showing each link's key. */
  linkDomain: string;
  items: LinkItem[];
  onChange: (items: LinkItem[]) => void;
  dirty: boolean;
  state: SaveState;
  viewerReason: string | null;
  onSave: () => void;
}) {
  const t = useTranslations("bio.links");
  const used = useMemo(
    () => new Set(items.map((item) => item.linkId)),
    [items],
  );
  const [armed, setArmed] = useState<number | null>(null);
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [dropAt, setDropAt] = useState<number | null>(null);
  const controls = useRef(new Map<string, HTMLButtonElement>());
  const pendingFocus = useRef<string | null>(null);
  const locked = viewerReason !== null;

  useEffect(() => {
    if (!pendingFocus.current) return;
    const target = controls.current.get(pendingFocus.current);
    pendingFocus.current = null;
    target?.focus();
  });

  const titleOf = (item: LinkItem) => item.title.trim() || item.key;

  const move = (from: number, to: number) => {
    const item = items[from];
    if (!item || to < 0 || to >= items.length || from === to) return;
    const next = items.filter((_, at) => at !== from);
    next.splice(to, 0, item);
    onChange(next);
    announce(
      t("moved", {
        title: titleOf(item),
        position: to + 1,
        total: items.length,
      }),
    );
  };

  // Focus follows the moved link; at the top or bottom its button for that
  // direction disables, so focus switches to the other one.
  const moveBy = (index: number, delta: -1 | 1) => {
    const item = items[index];
    if (!item) return;
    const to = index + delta;
    const atEdge = delta < 0 ? to === 0 : to === items.length - 1;
    const forward = delta < 0 ? "up" : "down";
    const back = delta < 0 ? "down" : "up";
    pendingFocus.current = `${item.linkId}:${atEdge ? back : forward}`;
    move(index, to);
  };

  const update = (index: number, patch: Partial<LinkItem>) =>
    onChange(
      items.map((item, at) => (at === index ? { ...item, ...patch } : item)),
    );

  const remove = (index: number) => {
    const item = items[index];
    if (!item) return;
    const neighbour = items[index + 1] ?? items[index - 1];
    if (neighbour) pendingFocus.current = `${neighbour.linkId}:remove`;
    onChange(items.filter((_, at) => at !== index));
    announce(t("removed", { title: titleOf(item) }));
  };

  const add = (link: LinkView) => {
    onChange([
      ...items,
      {
        linkId: link.id,
        key: link.key,
        url: link.url,
        title: link.title || link.key,
        image: "",
      },
    ]);
    announce(t("added", { title: link.title || link.key }));
  };

  const endDrag = () => {
    setArmed(null);
    setDragFrom(null);
    setDropAt(null);
  };

  const dragHandlers = (index: number) => ({
    draggable: armed === index,
    onDragStart: (event: DragEvent<HTMLLIElement>) => {
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", String(index));
      setDragFrom(index);
    },
    onDragOver: (event: DragEvent<HTMLLIElement>) => {
      if (dragFrom === null) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
      if (dropAt !== index) setDropAt(index);
    },
    onDrop: (event: DragEvent<HTMLLIElement>) => {
      event.preventDefault();
      if (dragFrom !== null) move(dragFrom, index);
      endDrag();
    },
    onDragEnd: endDrag,
  });

  const register = (key: string) => (element: HTMLButtonElement | null) => {
    if (element) controls.current.set(key, element);
    else controls.current.delete(key);
  };

  return (
    <BioSection
      title={t("title")}
      description={t("description")}
      dirty={dirty}
      state={state}
      saveLabel={t("save")}
      viewerReason={viewerReason}
      onSave={onSave}
    >
      {items.length === 0 ? (
        <p className="text-small text-fg-muted">{t("empty")}</p>
      ) : (
        <ol aria-label={t("listLabel")} className="flex flex-col">
          {items.map((item, index) => {
            const title = titleOf(item);
            return (
              <li
                key={item.linkId}
                {...(locked ? {} : dragHandlers(index))}
                className={cn(
                  "flex items-start gap-2 border-t border-line py-3 first:border-t-0 first:pt-0",
                  dragFrom === index && "opacity-50",
                  dropAt === index &&
                    dragFrom !== null &&
                    dragFrom !== index &&
                    (dragFrom < index
                      ? "shadow-[inset_0_-2px_0_var(--signal)]"
                      : "shadow-[inset_0_2px_0_var(--signal)]"),
                )}
              >
                <span
                  aria-hidden
                  onPointerDown={() => setArmed(index)}
                  onPointerUp={() => setArmed(null)}
                  className={cn(
                    "mt-1.5 grid size-5 shrink-0 place-items-center rounded-chip text-fg-subtle",
                    locked
                      ? "opacity-50"
                      : "cursor-grab hover:text-fg active:cursor-grabbing",
                  )}
                >
                  <GripVertical className="size-4" />
                </span>
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <p className="flex min-w-0 items-baseline gap-1.5 text-meta text-fg-muted">
                    <span className="shrink-0 font-mono tabular-nums">
                      {index + 1}.
                    </span>
                    <span className="shrink-0 font-mono">
                      {linkDomain}/<span className="text-fg">{item.key}</span>
                    </span>
                    <span className="min-w-0 truncate">
                      → {parseDestination(item.url).host}
                    </span>
                  </p>
                  <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)]">
                    <Input
                      aria-label={t("titleLabel", { key: item.key })}
                      maxLength={120}
                      placeholder={item.key}
                      value={item.title}
                      onChange={(event) =>
                        update(index, { title: event.target.value })
                      }
                    />
                    <Input
                      aria-label={t("imageLabel", { key: item.key })}
                      type="url"
                      inputMode="url"
                      spellCheck={false}
                      autoComplete="off"
                      maxLength={2048}
                      placeholder={t("imagePlaceholder")}
                      value={item.image}
                      aria-invalid={
                        state.error?.field === `link-${index}` || undefined
                      }
                      onChange={(event) =>
                        update(index, { image: event.target.value })
                      }
                    />
                  </div>
                </div>
                <div className="flex shrink-0 items-center">
                  <Button
                    ref={register(`${item.linkId}:up`)}
                    variant="ghost"
                    size="icon-sm"
                    aria-label={t("moveUp", { title })}
                    tooltip={t("moveUp", { title })}
                    disabled={index === 0}
                    onClick={() => moveBy(index, -1)}
                  >
                    <ArrowUp aria-hidden />
                  </Button>
                  <Button
                    ref={register(`${item.linkId}:down`)}
                    variant="ghost"
                    size="icon-sm"
                    aria-label={t("moveDown", { title })}
                    tooltip={t("moveDown", { title })}
                    disabled={index === items.length - 1}
                    onClick={() => moveBy(index, 1)}
                  >
                    <ArrowDown aria-hidden />
                  </Button>
                  <Button
                    ref={register(`${item.linkId}:remove`)}
                    variant="ghost"
                    size="icon-sm"
                    aria-label={t("remove", { title })}
                    tooltip={t("remove", { title })}
                    onClick={() => remove(index)}
                  >
                    <X aria-hidden />
                  </Button>
                </div>
              </li>
            );
          })}
        </ol>
      )}
      <div className="flex items-center gap-3">
        <LinkPicker
          workspace={workspace}
          exclude={used}
          onSelect={add}
          disabled={locked || items.length >= maxBioLinks}
          trigger={
            <Button disabled={locked || items.length >= maxBioLinks}>
              <Plus aria-hidden />
              {t("add")}
            </Button>
          }
        />
        {items.length >= maxBioLinks ? (
          <p className="text-meta text-fg-muted">
            {t("full", { max: maxBioLinks })}
          </p>
        ) : null}
      </div>
    </BioSection>
  );
}
