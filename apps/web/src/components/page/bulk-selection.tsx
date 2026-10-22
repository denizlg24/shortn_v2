"use client";

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
import { PageSelectionContext, SelectionBar } from "./selection-bar";

/**
 * Keeps a bounded ID selection across pages and filters; an action opens its
 * review page. Pages place `SelectPageCheckbox` in their header row.
 */
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
  actions?: {
    href: string;
    label: string;
    clear?: boolean;
    tone?: "danger";
  }[];
  children: ReactNode;
}) {
  const t = useTranslations("page.selection"),
    router = useRouter();
  const form = useRef<HTMLFormElement>(null);
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
  const choices = actions ?? [
    { href: action, label: t("delete"), tone: "danger" as const },
  ];
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
  }, [chosen, eligible]);
  const open = (choice: (typeof choices)[number]) => {
    if (!allowed || !selected.length) return;
    const selection = encodeSelection(selected);
    if (choice.clear !== false) choose([]);
    router.push(
      `${choice.href}${choice.href.includes("?") ? "&" : "?"}selection=${selection}`,
    );
  };
  return (
    <PageSelectionContext.Provider
      value={{
        enabled: allowed && enabled,
        eligible: eligible.length,
        onPage,
        setPage: (checked) =>
          choose(
            checked
              ? [...new Set([...selected, ...eligible])]
              : selected.filter((id) => !eligible.includes(id)),
          ),
      }}
    >
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
          const first = choices[0];
          if (first) open(first);
        }}
      >
        {error ? (
          <p role="alert" className="mb-3 text-small text-fg-muted">
            {t("limit", { limit })}
          </p>
        ) : null}
        {children}
        {allowed ? (
          <SelectionBar
            count={selected.length}
            limit={limit}
            status={t("count", { count: selected.length })}
            onClear={() => choose([])}
            actions={choices.map((choice) => ({
              label: choice.label,
              ...(choice.tone ? { tone: choice.tone } : {}),
              onSelect: () => open(choice),
            }))}
          />
        ) : null}
      </form>
    </PageSelectionContext.Provider>
  );
}
