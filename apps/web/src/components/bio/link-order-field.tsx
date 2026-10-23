"use client";
import { useId } from "react";
import { useTranslations } from "next-intl";
import { bioLinkOrders, type BioLinkOrder } from "@shortn/core/bio-content";

const control =
  "h-9 w-full min-w-0 rounded-control border border-line-strong bg-field px-2.5 text-small text-fg focus-visible:outline-2 focus-visible:outline-signal";

/** How a links section orders itself; shown in Manage links and section settings. */
export function LinkOrderField({
  value,
  onChange,
  disabled,
}: {
  value: BioLinkOrder;
  onChange: (order: BioLinkOrder) => void;
  disabled?: boolean;
}) {
  const t = useTranslations("bio.editor.order");
  const id = useId();
  return (
    <div className="grid gap-1.5">
      <label htmlFor={id} className="text-small font-medium">
        {t("label")}
      </label>
      <select
        id={id}
        className={control}
        value={value}
        disabled={disabled}
        aria-describedby={`${id}-hint`}
        onChange={(event) => {
          const next = bioLinkOrders.find((o) => o === event.target.value);
          if (next) onChange(next);
        }}
      >
        {bioLinkOrders.map((order) => (
          <option key={order} value={order}>
            {t(`options.${order}`)}
          </option>
        ))}
      </select>
      <p id={`${id}-hint`} className="text-small text-fg-muted">
        {t(`hints.${value}`)}
      </p>
    </div>
  );
}
