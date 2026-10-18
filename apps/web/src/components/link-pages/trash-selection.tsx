"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { buttonVariants } from "@shortn/ui";
import { restoreLinksAction } from "@/server/actions/links";

const limit = 1000;

export function TrashSelection({
  workspace,
  eligible,
  children,
}: {
  workspace: string;
  eligible: string[];
  children: ReactNode;
}) {
  const t = useTranslations("linkPages.trash");
  const selectionText = useTranslations("page.selection");
  const router = useRouter();
  const root = useRef<HTMLDivElement>(null);
  const all = useRef<HTMLInputElement>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);
  const storageKey = `shortn:trash-selection:${workspace}`;
  useEffect(() => {
    try {
      const saved: object = JSON.parse(
        sessionStorage.getItem(storageKey) ?? "[]",
      );
      if (Array.isArray(saved))
        setSelected(
          [
            ...new Set(
              saved.filter(
                (id): id is string =>
                  typeof id === "string" && /^[a-f\d]{24}$/i.test(id),
              ),
            ),
          ].slice(0, limit),
        );
    } catch {
      /* Selection still works when browser storage is unavailable. */
    }
  }, [storageKey]);
  const choose = (next: string[]) => {
    setSelected(next);
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(next));
    } catch {
      /* Optional persistence. */
    }
  };
  const onPage = eligible.filter((id) => selected.includes(id)).length;
  useEffect(() => {
    for (const input of root.current?.querySelectorAll<HTMLInputElement>(
      'input[name="ids"]',
    ) ?? [])
      input.checked = selected.includes(input.value);
    if (all.current)
      all.current.indeterminate = onPage > 0 && onPage < eligible.length;
  }, [selected, eligible, onPage]);
  const restore = async () => {
    setPending(true);
    setMessage("");
    try {
      const result = await restoreLinksAction(workspace, selected);
      if (!result.ok) {
        setError(true);
        setMessage(t("failed"));
        return;
      }
      choose(selected.filter((id) => !result.data.restored.includes(id)));
      const remaining = selected.length - result.data.restored.length;
      setError(remaining > 0);
      setMessage(
        remaining
          ? t("partial", { count: remaining })
          : t("restored", { count: result.data.restored.length }),
      );
      router.refresh();
    } catch {
      setError(true);
      setMessage(t("failed"));
    } finally {
      setPending(false);
    }
  };
  return (
    <div
      ref={root}
      onChange={(event) => {
        const input = event.target;
        if (!(input instanceof HTMLInputElement) || input.name !== "ids")
          return;
        if (input.checked && selected.length >= limit) {
          input.checked = false;
          setError(true);
          setMessage(t("limit", { limit }));
          return;
        }
        choose(
          input.checked
            ? [...new Set([...selected, input.value])]
            : selected.filter((id) => id !== input.value),
        );
      }}
    >
      <div className="mb-3 flex min-h-10 flex-wrap items-center gap-x-4 gap-y-2 border-b border-line pb-3">
        <label className="flex items-center gap-2 text-small">
          <input
            ref={all}
            type="checkbox"
            disabled={pending || !eligible.length}
            checked={eligible.length > 0 && onPage === eligible.length}
            className="size-4 accent-[var(--color-signal)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal"
            onChange={(event) => {
              const next = event.target.checked
                ? [...new Set([...selected, ...eligible])]
                : selected.filter((id) => !eligible.includes(id));
              if (next.length > limit) {
                setError(true);
                setMessage(t("limit", { limit }));
                return;
              }
              choose(next);
            }}
          />
          {selectionText("selectPage")}
        </label>
        <span role="status" className="text-small text-fg-muted">
          {t("selection", { count: selected.length, limit })}
        </span>
        <button
          type="button"
          disabled={pending || !selected.length}
          onClick={() => choose([])}
          className={buttonVariants({ variant: "ghost", size: "sm" })}
        >
          {selectionText("clear")}
        </button>
        <button
          type="button"
          disabled={pending || !selected.length}
          onClick={() => void restore()}
          className={buttonVariants({ variant: "secondary", size: "sm" })}
        >
          {pending ? t("restoring") : t("restore")}
        </button>
      </div>
      {message ? (
        <p
          role={error ? "alert" : "status"}
          className="mb-3 text-small text-fg-muted"
        >
          {message}
        </p>
      ) : null}
      <fieldset disabled={pending} className="min-w-0">
        {children}
      </fieldset>
    </div>
  );
}
