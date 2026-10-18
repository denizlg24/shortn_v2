"use client";

import { buttonVariants } from "@shortn/ui";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import {
  bulkSelectionLimit as limit,
  encodeSelection,
  normalizeSelection,
} from "@/lib/bulk-selection";

/** Keeps a bounded ID selection across pages/filters; submission opens review. */
export function BulkSelection({
  action,
  enabled,
  allowed = true,
  eligible,
  actions,
  children,
}: {
  action: string;
  enabled: boolean;
  allowed?: boolean;
  eligible: string[];
  actions?: { href: string; label: string; clear?: boolean }[];
  children: ReactNode;
}) {
  const t = useTranslations("page.selection"),
    router = useRouter();
  const form = useRef<HTMLFormElement>(null),
    selectAll = useRef<HTMLInputElement>(null);
  const [fallback, setFallback] = useState<{
      key: string;
      ids: string[];
      failed: boolean;
    }>({
      key: "",
      ids: [],
      failed: false,
    }),
    [error, setError] = useState(false);
  const storageKey = `shortn:bulk-selection:${action}`;
  const choices = actions ?? [{ href: action, label: t("delete") }];
  const subscribe = useCallback(
    (notify: () => void) => {
      const listener = (event: Event) => {
        if ((event as CustomEvent<string>).detail === storageKey) notify();
      };
      window.addEventListener("shortn:bulk-selection", listener);
      return () =>
        window.removeEventListener("shortn:bulk-selection", listener);
    },
    [storageKey],
  );
  const snapshot = useSyncExternalStore(
    subscribe,
    useCallback(() => {
      try {
        return sessionStorage.getItem(storageKey) ?? "[]";
      } catch {
        return null;
      }
    }, [storageKey]),
    () => null,
  );
  const stored = useMemo(() => {
    try {
      return normalizeSelection(JSON.parse(snapshot ?? "[]"));
    } catch {
      return [];
    }
  }, [snapshot]);
  const selected = useMemo(
    () =>
      allowed
        ? snapshot === null || (fallback.key === storageKey && fallback.failed)
          ? fallback.key === storageKey
            ? fallback.ids
            : []
          : stored
        : [],
    [allowed, snapshot, fallback, stored, storageKey],
  );
  const choose = (next: string[]) => {
    if (next.length > limit) {
      setError(true);
      return;
    }
    setError(false);
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(next));
      setFallback({ key: storageKey, ids: next, failed: false });
      window.dispatchEvent(
        new CustomEvent("shortn:bulk-selection", { detail: storageKey }),
      );
    } catch {
      setFallback({ key: storageKey, ids: next, failed: true });
    }
  };
  const chosen = useMemo(() => new Set(selected), [selected]),
    onPage = eligible.filter((id) => chosen.has(id)).length;
  useEffect(() => {
    for (const input of form.current?.querySelectorAll<HTMLInputElement>(
      'input[type="checkbox"][name="ids"]',
    ) ?? [])
      input.checked = chosen.has(input.value);
    if (selectAll.current)
      selectAll.current.indeterminate = onPage > 0 && onPage < eligible.length;
  }, [chosen, eligible, onPage]);
  return (
    <form
      ref={form}
      method="get"
      action={action}
      onChange={(event) => {
        const input = event.target;
        if (
          !allowed ||
          !(input instanceof HTMLInputElement) ||
          input.name !== "ids" ||
          !eligible.includes(input.value)
        )
          return;
        if (input.checked && selected.length >= limit) {
          input.checked = false;
          setError(true);
          return;
        }
        choose(
          input.checked
            ? [...new Set([...selected, input.value])]
            : selected.filter((id) => id !== input.value),
        );
      }}
      onSubmit={(event) => {
        event.preventDefault();
        if (!allowed || !selected.length) return;
        const submitter = (event.nativeEvent as SubmitEvent).submitter;
        const href =
          submitter?.getAttribute("formaction") ?? choices[0]?.href ?? action;
        const choice = choices.find((item) => item.href === href);
        if (!choice) return;
        const selection = encodeSelection(selected);
        if (choice.clear !== false) choose([]);
        router.push(
          `${href}${href.includes("?") ? "&" : "?"}selection=${selection}`,
        );
      }}
    >
      {allowed && (enabled || selected.length > 0) ? (
        <div className="mb-3 flex min-h-10 flex-wrap items-center gap-x-4 gap-y-2 border-b border-line pb-3">
          <label className="flex items-center gap-2 text-small">
            <input
              ref={selectAll}
              type="checkbox"
              disabled={!eligible.length}
              checked={eligible.length > 0 && onPage === eligible.length}
              onChange={(event) =>
                choose(
                  event.target.checked
                    ? [...new Set([...selected, ...eligible])]
                    : selected.filter((id) => !eligible.includes(id)),
                )
              }
              className="size-4 accent-[var(--color-signal)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal"
            />
            {t("selectPage")}
          </label>
          <span role="status" className="text-small text-fg-muted">
            {t("count", { count: selected.length })}
          </span>
          <span className="text-meta text-fg-muted">
            {t("maximum", { limit })}
          </span>
          {selected.length > 0 ? (
            <button
              type="button"
              onClick={() => choose([])}
              className={buttonVariants({ variant: "ghost", size: "sm" })}
            >
              {t("clear")}
            </button>
          ) : null}
          {choices.map((choice) => (
            <button
              key={choice.href}
              type="submit"
              formAction={choice.href}
              disabled={!selected.length}
              className={buttonVariants({ variant: "secondary", size: "sm" })}
            >
              {choice.label}
            </button>
          ))}
        </div>
      ) : null}
      {error ? (
        <p role="alert" className="mb-3 text-small text-fg-muted">
          {t("limit", { limit })}
        </p>
      ) : null}
      {children}
    </form>
  );
}
