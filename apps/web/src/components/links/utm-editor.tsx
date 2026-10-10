"use client";

import { Button, Input, Label } from "@shortn/ui";
import { Plus, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId } from "react";
import {
  emptyUtm,
  maxUtmVariants,
  utmFields,
  utmMaxLength,
  utmQuery,
  type UtmDraft,
} from "./link-draft";

export function UtmEditor({
  value,
  onChange,
  disabled,
  invalid,
}: {
  value: UtmDraft[];
  onChange: (value: UtmDraft[]) => void;
  disabled: boolean;
  invalid?: boolean;
}) {
  const t = useTranslations("links.utm");
  const id = useId();
  const update = (index: number, next: UtmDraft) =>
    onChange(value.map((variant, at) => (at === index ? next : variant)));

  return (
    <div className="flex flex-col gap-3">
      {value.length === 0 ? (
        <p className="text-small text-fg-muted">{t("empty")}</p>
      ) : (
        <ol className="flex flex-col">
          {value.map((variant, index) => {
            const query = utmQuery(variant);
            return (
              <li
                key={index}
                className="flex flex-col gap-2 border-t border-line py-3 first:border-t-0 first:pt-0"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-meta font-medium text-fg-muted">
                    {t("variant", { number: index + 1 })}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={t("remove", { number: index + 1 })}
                    tooltip={t("remove", { number: index + 1 })}
                    disabled={disabled}
                    onClick={() =>
                      onChange(value.filter((_, at) => at !== index))
                    }
                  >
                    <X aria-hidden />
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-x-2 gap-y-2 max-sm:grid-cols-1">
                  {utmFields.map((field) => {
                    const fieldId = `${id}-${index}-${field}`;
                    return (
                      <div key={field} className="flex min-w-0 flex-col gap-1">
                        <Label
                          htmlFor={fieldId}
                          className="text-meta font-normal text-fg-muted"
                        >
                          {t(`fields.${field}`)}
                        </Label>
                        <Input
                          id={fieldId}
                          size="sm"
                          value={variant[field]}
                          maxLength={utmMaxLength[field]}
                          disabled={disabled}
                          aria-invalid={invalid || undefined}
                          placeholder={t(`placeholders.${field}`)}
                          onChange={(event) =>
                            update(index, {
                              ...variant,
                              [field]: event.target.value,
                            })
                          }
                        />
                      </div>
                    );
                  })}
                </div>
                {query ? (
                  <p
                    className="truncate font-mono text-meta text-fg-subtle"
                    title={query}
                  >
                    {query}
                  </p>
                ) : null}
              </li>
            );
          })}
        </ol>
      )}
      <Button
        variant="secondary"
        size="sm"
        className="self-start"
        disabled={disabled || value.length >= maxUtmVariants}
        onClick={() => onChange([...value, { ...emptyUtm }])}
      >
        <Plus aria-hidden />
        {t("add")}
      </Button>
    </div>
  );
}
