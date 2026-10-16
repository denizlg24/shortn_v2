"use client";
import Link from "next/link";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { useTranslations } from "next-intl";
import { Button, Combobox, buttonVariants, fieldFrame, cn } from "@shortn/ui";
import { bulkLinkTagsAction } from "@/server/actions/bulk-link-tags";
import { searchLinkTagsAction } from "@/server/actions/link-tags";

type Mode = "add" | "remove" | "replace";
export function BulkTagsForm({
  workspace,
  selectionRef,
  count,
  initial,
}: {
  workspace: string;
  selectionRef: string;
  count: number;
  initial: string[];
}) {
  const t = useTranslations("bulkTags"),
    [mode, setMode] = useState<Mode>("add"),
    [tags, setTags] = useState<string[]>([]),
    [confirmed, setConfirmed] = useState(false);
  const [options, setOptions] = useState(
      initial.map((name) => ({ value: name, label: name })),
    ),
    [searchFailed, setSearchFailed] = useState(false),
    [error, setError] = useState(""),
    [pending, setPending] = useState(false),
    [success, setSuccess] = useState<{
      selected: number;
      updated: number;
    } | null>(null);
  const guard = useRef(false),
    sequence = useRef(0),
    timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined),
    alert = useRef<HTMLParagraphElement>(null);
  useEffect(
    () => () => {
      clearTimeout(timer.current);
      sequence.current++;
    },
    [],
  );
  useEffect(() => {
    if (error) alert.current?.focus();
  }, [error]);
  const search = useCallback(
    (query: string) => {
      clearTimeout(timer.current);
      const current = ++sequence.current;
      timer.current = setTimeout(() => {
        void searchLinkTagsAction(workspace, query.slice(0, 200))
          .then((result) => {
            if (current !== sequence.current) return;
            setOptions(result.items);
            setSearchFailed(Boolean(result.error));
          })
          .catch(() => {
            if (current === sequence.current) setSearchFailed(true);
          });
      }, 250);
    },
    [workspace],
  );
  function choose(next: string[]) {
    const unique = [
      ...new Map(
        next.map((value) => {
          const name = value.trim().replace(/\s+/g, " ");
          return [name.toLowerCase(), name];
        }),
      ).values(),
    ];
    if (
      unique.length > 50 ||
      unique.some((name) => !name || name.length > 48)
    ) {
      setError("invalid_input");
      return;
    }
    setError("");
    setTags(unique);
    setConfirmed(false);
  }
  const errorKey =
    error === "forbidden" ||
    error === "not_found" ||
    error === "invalid_input" ||
    error === "tag_limit"
      ? error
      : "failed";
  const clearsAll = mode === "replace" && !tags.length;
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (guard.current) return;
    if ((mode !== "replace" && !tags.length) || (clearsAll && !confirmed)) {
      setError("invalid_input");
      return;
    }
    guard.current = true;
    setPending(true);
    setError("");
    try {
      const result = await bulkLinkTagsAction(
        workspace,
        selectionRef,
        mode,
        tags,
      );
      if (result.error) setError(result.error);
      else if (result.value) {
        const key = `shortn:bulk-selection:/${workspace}/links/delete`;
        try {
          sessionStorage.setItem(key, "[]");
          window.dispatchEvent(
            new CustomEvent("shortn:bulk-selection", { detail: key }),
          );
        } catch {
          /* Mutation succeeded even if selection storage is unavailable. */
        }
        setSuccess(result.value);
      }
    } catch {
      setError("failed");
    } finally {
      guard.current = false;
      setPending(false);
    }
  }
  if (success)
    return (
      <div className="flex flex-col gap-4">
        <p role="status" className="text-small">
          {t("success", success)}
        </p>
        <Link
          href={`/${workspace}/links`}
          className={buttonVariants({
            variant: "primary",
            size: "md",
            className: "self-start",
          })}
        >
          {t("back")}
        </Link>
      </div>
    );
  return (
    <form onSubmit={submit} className="flex min-w-0 flex-col gap-5">
      <div className="flex flex-col gap-2">
        <label htmlFor="bulk-tag-mode" className="text-small font-medium">
          {t("mode")}
        </label>
        <select
          id="bulk-tag-mode"
          value={mode}
          disabled={pending}
          onChange={(event) => {
            setMode(event.target.value as Mode);
            setConfirmed(false);
            setError("");
          }}
          className={cn(
            fieldFrame,
            "h-9 px-3 text-small font-normal focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal",
          )}
        >
          {(["add", "remove", "replace"] as const).map((value) => (
            <option key={value} value={value}>
              {t(`modes.${value}`)}
            </option>
          ))}
        </select>
      </div>
      <p className="text-small text-fg-muted">
        {t(`effects.${mode}`, { count })}
      </p>
      <div className="min-w-0">
        <label
          htmlFor="bulk-tag-choice"
          className="mb-2 block text-small font-medium"
        >
          {t("tags")}
        </label>
        <Combobox
          id="bulk-tag-choice"
          multiple
          options={options}
          value={tags}
          onValueChange={choose}
          onSearchChange={search}
          disabled={pending}
          placeholder={t("choose")}
          searchPlaceholder={t("search")}
          emptyText={t("empty")}
          {...(mode !== "remove"
            ? {
                createLabel: (name: string) => t("create", { name }),
                onCreate: (name: string) => choose([...tags, name]),
              }
            : {})}
        />
        <p
          role={searchFailed ? "status" : undefined}
          className="mt-2 text-meta text-fg-muted"
        >
          {t(searchFailed ? "searchFailed" : "searchHelp")}
        </p>
      </div>
      {tags.length ? (
        <ul aria-label={t("chosen")} className="flex flex-wrap gap-2">
          {tags.map((tag) => (
            <li key={tag.toLowerCase()} className="min-w-0 max-w-full">
              <button
                type="button"
                disabled={pending}
                onClick={() => choose(tags.filter((value) => value !== tag))}
                aria-label={t("removeChoice", { name: tag })}
                title={t("removeChoice", { name: tag })}
                className="max-w-full truncate rounded-control bg-bg-subtle px-3 py-2 text-small text-fg hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal"
              >
                {tag}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <p className="text-small tabular-nums text-fg-muted">
        {t("summary", { count, tags: tags.length })}
      </p>
      {clearsAll ? (
        <label className="flex items-start gap-2 text-small">
          <input
            type="checkbox"
            checked={confirmed}
            disabled={pending}
            onChange={(event) => setConfirmed(event.target.checked)}
            className="mt-0.5 size-4 shrink-0 accent-signal focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal"
          />
          {t("confirmClear", { count })}
        </label>
      ) : null}
      {error ? (
        <p
          ref={alert}
          role="alert"
          tabIndex={-1}
          className="text-small text-danger"
        >
          {t(`errors.${errorKey}`)}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-3">
        <Button
          type="submit"
          variant="primary"
          loading={pending}
          disabled={
            pending ||
            (mode !== "replace" && !tags.length) ||
            (clearsAll && !confirmed)
          }
        >
          {t(clearsAll ? "clear" : "apply")}
        </Button>
        <Link
          href={`/${workspace}/links`}
          className={buttonVariants({ variant: "secondary", size: "md" })}
        >
          {t("cancel")}
        </Link>
      </div>
    </form>
  );
}
