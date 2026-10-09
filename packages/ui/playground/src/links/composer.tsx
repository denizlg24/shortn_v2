import { Button, cn, Input } from "@shortn/ui";
import { Link2, X } from "lucide-react";
import {
  useEffect,
  useId,
  useRef,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import { usePlayground } from "../app-context";
import { DEMO_DOMAIN } from "../data/links";

export interface ComposerDraft {
  url: string;
  key: string;
  keyEdited: boolean;
  error: { field: "url" | "key"; message: string } | null;
}

export const EMPTY_DRAFT: ComposerDraft = {
  url: "",
  key: "",
  keyEdited: false,
  error: null,
};

interface ComposerProps {
  draft: ComposerDraft;
  onChange: (draft: ComposerDraft) => void;
  onSubmit: () => void;
  onClose: () => void;
  onMoreOptions: () => void;
  suggestKey: (url: string) => string;
  focusToken: number;
}

export function Composer({
  draft,
  onChange,
  onSubmit,
  onClose,
  onMoreOptions,
  suggestKey,
  focusToken,
}: ComposerProps) {
  const { copy } = usePlayground();
  const urlRef = useRef<HTMLInputElement>(null);
  const errorId = useId();
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
    onSubmit();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLFormElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      onClose();
    }
  };

  return (
    <form
      aria-label={copy.composer.label}
      onSubmit={handleSubmit}
      onKeyDown={handleKeyDown}
      className="flex shrink-0 flex-col gap-1.5 border-b border-line bg-bg-subtle px-gutter py-3"
    >
      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor={urlId} className="sr-only">
          {copy.composer.url}
        </label>
        <Input
          ref={urlRef}
          id={urlId}
          type="url"
          inputMode="url"
          autoComplete="off"
          spellCheck={false}
          size="lg"
          leading={<Link2 aria-hidden />}
          placeholder={copy.composer.urlPlaceholder}
          value={draft.url}
          aria-invalid={draft.error?.field === "url" || undefined}
          aria-describedby={draft.error?.field === "url" ? errorId : undefined}
          onChange={(event) => {
            const url = event.target.value;
            onChange({
              ...draft,
              url,
              key: draft.keyEdited ? draft.key : url ? suggestKey(url) : "",
              error: null,
            });
          }}
          frameClassName="min-w-0 flex-[1_1_320px] bg-bg"
        />
        <label htmlFor={keyId} className="sr-only">
          {copy.composer.key}
        </label>
        <Input
          id={keyId}
          size="lg"
          autoComplete="off"
          spellCheck={false}
          leading={
            <span className="text-body text-fg-subtle">{DEMO_DOMAIN}/</span>
          }
          placeholder={copy.composer.keyPlaceholder}
          value={draft.key}
          maxLength={64}
          aria-invalid={draft.error?.field === "key" || undefined}
          aria-describedby={draft.error?.field === "key" ? errorId : undefined}
          onChange={(event) =>
            onChange({
              ...draft,
              key: event.target.value.replace(/\s+/g, "-"),
              keyEdited: true,
              error: null,
            })
          }
          frameClassName="min-w-0 flex-[1_1_220px] bg-bg sm:max-w-72 [&>span:first-child]:pr-0 gap-0"
          className="font-medium"
        />
        <div className="flex items-center gap-1.5 max-sm:w-full">
          <Button
            variant="ghost"
            size="lg"
            onClick={onMoreOptions}
            className="max-sm:flex-1"
          >
            {copy.composer.more}
          </Button>
          <Button
            variant="primary"
            size="lg"
            type="submit"
            shortcut="enter"
            className="max-sm:flex-1"
          >
            {copy.composer.create}
          </Button>
          <Button
            variant="ghost"
            size="icon-md"
            className="size-9"
            aria-label={copy.composer.close}
            tooltip={copy.composer.close}
            shortcut="esc"
            onClick={onClose}
          >
            <X aria-hidden />
          </Button>
        </div>
      </div>
      <p
        id={errorId}
        role={draft.error ? "alert" : undefined}
        className={cn("text-meta", draft.error ? "text-danger" : "sr-only")}
      >
        {draft.error?.message ?? ""}
      </p>
    </form>
  );
}

export function PinnedPasteField({ onActivate }: { onActivate: () => void }) {
  const { copy } = usePlayground();
  return (
    <div className="shrink-0 border-b border-line bg-bg-subtle px-gutter py-2.5 md:hidden">
      <button
        type="button"
        onClick={onActivate}
        className="flex h-10 w-full cursor-text items-center gap-2 rounded-control border border-line-strong bg-bg px-3 py-2 text-left text-body text-fg-subtle"
      >
        <Link2 aria-hidden className="size-4" />
        {copy.links.paste}
      </button>
    </div>
  );
}
