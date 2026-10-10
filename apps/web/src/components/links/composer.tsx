"use client";

import type { PlanId } from "@shortn/billing";
import { Button, cn, Input } from "@shortn/ui";
import { Link2, X } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import { PlanGate } from "../plan-gate";
import { FormErrorText, type FormError } from "./form-error";

export interface ComposerDraft {
  url: string;
  key: string;
  error: FormError | null;
}

export const emptyComposerDraft: ComposerDraft = {
  url: "",
  key: "",
  error: null,
};

interface ComposerProps {
  draft: ComposerDraft;
  onChange: (draft: ComposerDraft) => void;
  onSubmit: () => void;
  onClose: () => void;
  onMoreOptions: () => void;
  focusToken: number;
  domain: string;
  /** Set when the plan has no custom keys; the key field then explains why on focus. */
  keyGate: PlanId | null;
  pending: boolean;
}

export function Composer({
  draft,
  onChange,
  onSubmit,
  onClose,
  onMoreOptions,
  focusToken,
  domain,
  keyGate,
  pending,
}: ComposerProps) {
  const t = useTranslations("links.composer");
  const urlRef = useRef<HTMLInputElement>(null);
  const [gateShown, setGateShown] = useState(false);
  const messageId = useId();
  const urlId = useId();
  const keyId = useId();

  useEffect(() => {
    const input = urlRef.current;
    if (!input) return;
    input.focus();
    const end = input.value.length;
    input.setSelectionRange(end, end);
  }, [focusToken]);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!pending) onSubmit();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLFormElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      onClose();
    }
  };

  const error = draft.error;
  const describedBy = (field: "url" | "key") =>
    error?.field === field || (field === "key" && gateShown && keyGate)
      ? messageId
      : undefined;

  return (
    <form
      aria-label={t("label")}
      onSubmit={handleSubmit}
      onKeyDown={handleKeyDown}
      className="flex shrink-0 flex-col gap-1.5 border-b border-line bg-bg-subtle px-gutter py-3"
    >
      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor={urlId} className="sr-only">
          {t("url")}
        </label>
        <Input
          ref={urlRef}
          id={urlId}
          type="url"
          inputMode="url"
          autoComplete="off"
          spellCheck={false}
          size="lg"
          maxLength={2048}
          leading={<Link2 aria-hidden />}
          placeholder={t("urlPlaceholder")}
          value={draft.url}
          aria-invalid={error?.field === "url" || undefined}
          aria-describedby={describedBy("url")}
          onChange={(event) =>
            onChange({ ...draft, url: event.target.value, error: null })
          }
          frameClassName="min-w-0 flex-[1_1_320px] bg-bg"
        />
        <label htmlFor={keyId} className="sr-only">
          {t("key")}
        </label>
        <Input
          id={keyId}
          size="lg"
          autoComplete="off"
          spellCheck={false}
          readOnly={keyGate !== null}
          leading={<span className="text-body text-fg-subtle">{domain}/</span>}
          placeholder={t("keyPlaceholder")}
          value={keyGate ? "" : draft.key}
          maxLength={64}
          aria-invalid={error?.field === "key" || undefined}
          aria-describedby={describedBy("key")}
          onFocus={() => {
            if (keyGate) setGateShown(true);
          }}
          onChange={(event) =>
            onChange({
              ...draft,
              key: event.target.value.replace(/\s+/g, "-"),
              error: null,
            })
          }
          frameClassName={cn(
            "min-w-0 flex-[1_1_220px] bg-bg sm:max-w-72 [&>span:first-child]:pr-0 gap-0",
            keyGate && "cursor-default",
          )}
          className="font-medium"
        />
        <div className="flex items-center gap-1.5 max-sm:w-full">
          <Button
            variant="ghost"
            size="lg"
            onClick={onMoreOptions}
            className="max-sm:flex-1"
          >
            {t("more")}
          </Button>
          <Button
            variant="primary"
            size="lg"
            type="submit"
            shortcut="enter"
            loading={pending}
            className="max-sm:flex-1"
          >
            {t("create")}
          </Button>
          <Button
            variant="ghost"
            size="icon-md"
            className="size-9"
            aria-label={t("close")}
            tooltip={t("close")}
            shortcut="esc"
            onClick={onClose}
          >
            <X aria-hidden />
          </Button>
        </div>
      </div>
      <div id={messageId}>
        {error ? (
          <FormErrorText error={error} />
        ) : keyGate && gateShown ? (
          <PlanGate feature="customKeys" plan={keyGate} className="text-meta" />
        ) : null}
      </div>
    </form>
  );
}

export function PinnedPasteField({ onActivate }: { onActivate: () => void }) {
  const t = useTranslations("links");
  return (
    <div className="shrink-0 border-b border-line bg-bg-subtle px-gutter py-2.5 md:hidden">
      <button
        type="button"
        onClick={onActivate}
        className="flex h-10 w-full cursor-text items-center gap-2 rounded-control border border-line-strong bg-bg px-3 py-2 text-left text-body text-fg-subtle"
      >
        <Link2 aria-hidden className="size-4" />
        {t("paste")}
      </button>
    </div>
  );
}
