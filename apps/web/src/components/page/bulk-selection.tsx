"use client";

import { buttonVariants } from "@shortn/ui";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState, type ReactNode } from "react";

/** Selects only deletable rows on the current page; submission opens confirmation. */
export function BulkSelection({
  action,
  enabled,
  children,
}: {
  action: string;
  enabled: boolean;
  children: ReactNode;
}) {
  const t = useTranslations("page.selection");
  const form = useRef<HTMLFormElement>(null);
  const selectAll = useRef<HTMLInputElement>(null);
  const [selection, setSelection] = useState({ count: 0, total: 0 });
  const rows = () => [
    ...(form.current?.querySelectorAll<HTMLInputElement>(
      'input[type="checkbox"][name="ids"]:not(:disabled)',
    ) ?? []),
  ];
  const update = () => {
    const inputs = rows();
    setSelection({
      count: inputs.filter((input) => input.checked).length,
      total: inputs.length,
    });
  };
  useEffect(() => {
    if (selectAll.current)
      selectAll.current.indeterminate =
        selection.count > 0 && selection.count < selection.total;
  }, [selection]);
  const choose = (checked: boolean) => {
    for (const input of rows()) input.checked = checked;
    update();
  };
  return (
    <form
      ref={form}
      method="get"
      action={action}
      onChange={update}
      onSubmit={(event) => {
        if (!rows().some((input) => input.checked)) event.preventDefault();
      }}
    >
      {enabled ? (
        <div className="mb-3 flex min-h-10 flex-wrap items-center gap-x-4 gap-y-2 border-b border-line pb-3">
          <label className="flex items-center gap-2 text-small">
            <input
              ref={selectAll}
              type="checkbox"
              checked={
                selection.total > 0 && selection.count === selection.total
              }
              onChange={(event) => choose(event.target.checked)}
              className="size-4 accent-[var(--color-signal)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal"
            />
            {t("selectPage")}
          </label>
          <span role="status" className="text-small text-fg-muted">
            {t("count", { count: selection.count })}
          </span>
          {selection.count > 0 ? (
            <button
              type="button"
              onClick={() => choose(false)}
              className={buttonVariants({ variant: "ghost", size: "sm" })}
            >
              {t("clear")}
            </button>
          ) : null}
          <button
            type="submit"
            disabled={selection.count === 0}
            className={buttonVariants({ variant: "secondary", size: "sm" })}
          >
            {t("delete")}
          </button>
        </div>
      ) : null}
      {children}
    </form>
  );
}
