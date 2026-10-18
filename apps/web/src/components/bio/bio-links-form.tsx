"use client";

import type { BioEditable, LinkView } from "@shortn/core";
import { announce, Button, cn, parseDestination } from "@shortn/ui";
import { ArrowDown, ArrowUp, GripVertical, Plus, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import type { FormState } from "@/server/actions/link-pages";
import { LinkPicker } from "../editor/link-picker";
import { useFormSubmit } from "../editor/use-form-submit";
import { inputClass } from "../page/form";
import { Section } from "../page/page";
import { ImageUpload, useUploadStatus } from "../page/image-upload";
import {
  appearanceOf,
  linksOf,
  profileOf,
  socialsOf,
  type LinkItem,
} from "./bio-draft";
import { BioFormFooter } from "./bio-form-footer";
import { BioPhone, BioSplit } from "./bio-phone";
import { maxBioLinks } from "./bio-rules";

/** /bio/{id}/links: the buttons on the page, in order, with the phone beside. */
export function BioLinksForm({
  workspace,
  linkDomain,
  bio,
  action,
  cancelHref,
}: {
  workspace: string;
  /** Short link domain, for showing each link's key. */
  linkDomain: string;
  bio: BioEditable;
  action: (state: FormState, form: FormData) => Promise<FormState>;
  cancelHref: string;
}) {
  const t = useTranslations("bio.links");
  const tBio = useTranslations("bio");
  const { state, pending, onSubmit } = useFormSubmit(action);
  const [items, onChange] = useState(() => linksOf(bio));
  const [submittedItems, setSubmittedItems] = useState(items);
  const visibleState: FormState =
    submittedItems === items ? state : { error: null };
  const [rest] = useState(() => ({
    profile: profileOf(bio),
    socials: socialsOf(bio),
    appearance: appearanceOf(bio),
  }));
  const uploads = useUploadStatus();
  const used = useMemo(
    () => new Set(items.map((item) => item.linkId)),
    [items],
  );
  const [armed, setArmed] = useState<number | null>(null);
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [dropAt, setDropAt] = useState<number | null>(null);
  const controls = useRef(new Map<string, HTMLButtonElement>());
  const pendingFocus = useRef<string | null>(null);

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
    <form
      onSubmit={(event) => {
        setSubmittedItems(items);
        onSubmit(event);
      }}
      noValidate
    >
      <BioSplit
        preview={
          <BioPhone
            drafts={{ ...rest, links: items }}
            caption={tBio("preview.draft")}
          />
        }
      >
        <Section title={t("title")}>
          <input type="hidden" name="links" value={JSON.stringify(items)} />
          {items.length === 0 ? (
            <p className="text-small text-fg-muted">{t("empty")}</p>
          ) : (
            <ol aria-label={t("listLabel")} className="flex flex-col">
              {items.map((item, index) => {
                const title = titleOf(item);
                return (
                  <li
                    key={item.linkId}
                    {...dragHandlers(index)}
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
                      className="mt-2 grid size-5 shrink-0 cursor-grab place-items-center rounded-chip text-fg-subtle hover:text-fg active:cursor-grabbing"
                    >
                      <GripVertical className="size-4" />
                    </span>
                    <div className="flex min-w-0 flex-1 flex-col gap-2">
                      <p className="flex min-w-0 items-baseline gap-1.5 text-meta text-fg-muted">
                        <span className="shrink-0 font-mono tabular-nums">
                          {index + 1}.
                        </span>
                        <span
                          className="min-w-0 break-all font-mono"
                          title={`${linkDomain}/${item.key}`}
                        >
                          {linkDomain}/
                          <span className="text-fg">{item.key}</span>
                        </span>
                        <span className="min-w-0 truncate">
                          → {parseDestination(item.url).host}
                        </span>
                      </p>
                      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)]">
                        <input
                          aria-label={t("titleLabel", { key: item.key })}
                          maxLength={120}
                          placeholder={item.key}
                          value={item.title}
                          onChange={(event) =>
                            update(index, { title: event.target.value })
                          }
                          className={inputClass}
                        />
                        <ImageUpload
                          label={t("imageLabel", { key: item.key })}
                          value={item.image}
                          onChange={(image) => update(index, { image })}
                          onBusyChange={uploads.onBusyChange}
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
              disabled={items.length >= maxBioLinks}
              trigger={
                <Button disabled={items.length >= maxBioLinks}>
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
        </Section>
        <BioFormFooter
          state={visibleState}
          pending={pending || uploads.uploading}
          submitLabel={t("save")}
          cancelHref={cancelHref}
        />
      </BioSplit>
    </form>
  );
}
