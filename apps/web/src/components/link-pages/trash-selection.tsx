"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { restoreLinksAction } from "@/server/actions/links";
import {
  PageSelectionContext,
  SelectionBar,
} from "@/components/page/selection-bar";

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
  }, [selected, eligible]);
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
    <PageSelectionContext.Provider
      value={{
        enabled: !pending,
        eligible: eligible.length,
        onPage,
        setPage: (checked) => {
          const next = checked
            ? [...new Set([...selected, ...eligible])]
            : selected.filter((id) => !eligible.includes(id));
          if (next.length > limit) {
            setError(true);
            setMessage(t("limit", { limit }));
            return;
          }
          choose(next);
        },
      }}
    >
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
        <SelectionBar
          count={selected.length}
          limit={limit}
          status={selectionText("count", { count: selected.length })}
          busy={pending}
          onClear={() => choose([])}
          actions={[
            {
              label: pending ? t("restoring") : t("restore"),
              onSelect: () => void restore(),
            },
          ]}
        />
      </div>
    </PageSelectionContext.Provider>
  );
}
