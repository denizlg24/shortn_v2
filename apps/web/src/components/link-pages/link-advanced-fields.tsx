"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import type { LinkRulesInput, SocialPreview } from "@shortn/core";
import { Button } from "@shortn/ui";
import { inputClass } from "../page/form";

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex min-w-0 flex-col gap-2 text-small font-medium">
      {label}
      {children}
    </label>
  );
}
type Kind = "geo" | "device" | "rotation";
const rowFields = {
  geo: ["country", "url"],
  device: ["os", "device", "url"],
  rotation: ["url", "weight"],
} as const;
type Row = { id: string; values: Record<string, string> };
export function LinkAdvancedFields({
  initial,
  preview,
  pending,
  error,
}: {
  initial?: LinkRulesInput;
  preview?: SocialPreview;
  pending: boolean;
  error: boolean;
}) {
  const t = useTranslations("linkAdvanced"),
    alert = useRef<HTMLParagraphElement>(null);
  const [values, setValues] = useState<Record<string, string>>(() => ({
    activeFrom: initial?.activeFrom?.replace(/Z$/, "") ?? "",
    expiresAt: initial?.expiresAt?.replace(/Z$/, "") ?? "",
    maxClicks: initial?.maxClicks?.toString() ?? "",
    expiredUrl: initial?.expiredUrl ?? "",
    "deepLink.ios": initial?.deepLink?.ios ?? "",
    "deepLink.android": initial?.deepLink?.android ?? "",
    "deepLink.fallback": initial?.deepLink?.fallback ?? "web",
    "deepLink.store.ios": initial?.deepLink?.store?.ios ?? "",
    "deepLink.store.android": initial?.deepLink?.store?.android ?? "",
    ...Object.fromEntries(
      Object.entries(initial?.utm ?? {}).map(([key, value]) => [
        `utm.${key}`,
        value ?? "",
      ]),
    ),
  }));
  const [forward, setForward] = useState(Boolean(initial?.forwardQuery)),
    [permanent, setPermanent] = useState(Boolean(initial?.permanent));
  const [og, setOg] = useState<Record<string, string>>({
    title: preview?.title ?? "",
    description: preview?.description ?? "",
    image: preview?.image ?? "",
  });
  const [rows, setRows] = useState<Record<Kind, Row[]>>(
    () =>
      Object.fromEntries(
        (["geo", "device", "rotation"] as const).map((kind) => [
          kind,
          (initial?.[kind] ?? []).map((row, index) => ({
            id: `${kind}-${index}`,
            values: Object.fromEntries(
              Object.entries(row).map(([key, value]) => [key, String(value)]),
            ),
          })),
        ]),
      ) as Record<Kind, Row[]>,
  );
  useEffect(() => {
    if (error) alert.current?.focus();
  }, [error]);
  const text = (key: string, type = "text", maxLength = 2048) => (
    <input
      name={`rule.${key}`}
      type={type}
      step={type === "datetime-local" ? "0.001" : undefined}
      value={values[key] ?? ""}
      onChange={(event) =>
        setValues((current) => ({ ...current, [key]: event.target.value }))
      }
      maxLength={maxLength}
      className={inputClass}
    />
  );
  const summary = (title: string, effect: string) => (
    <summary className="cursor-pointer py-4 text-small font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal">
      <span>{title}</span>
      <span className="mt-1 block font-normal text-fg-muted">{effect}</span>
    </summary>
  );
  const scheduleSummary =
    [
      values.activeFrom
        ? t("activeSummary", { value: values.activeFrom.replace("T", " ") })
        : "",
      values.expiresAt
        ? t("expiresSummary", { value: values.expiresAt.replace("T", " ") })
        : "",
      values.maxClicks
        ? t("limitSummary", { count: Number(values.maxClicks) })
        : "",
    ]
      .filter(Boolean)
      .join(" · ") || t("scheduleNone");
  function updateRow(kind: Kind, rowId: string, field: string, value: string) {
    setRows((current) => ({
      ...current,
      [kind]: current[kind].map((row) =>
        row.id === rowId
          ? { ...row, values: { ...row.values, [field]: value } }
          : row,
      ),
    }));
  }
  return (
    <fieldset
      disabled={pending}
      className="min-w-0 divide-y divide-line border-y border-line"
    >
      <input type="hidden" name="advancedVersion" value="1" />
      {error ? (
        <p
          ref={alert}
          tabIndex={-1}
          role="alert"
          className="py-4 text-small text-danger"
        >
          {t("invalid")}
        </p>
      ) : null}
      <details open={error || undefined}>
        {summary(t("schedule"), scheduleSummary)}
        <div className="flex flex-col gap-4 pb-5">
          <p className="text-small text-fg-muted">{t("utc")}</p>
          <Field label={t("activeFrom")}>
            {text("activeFrom", "datetime-local")}
          </Field>
          <Field label={t("expiresAt")}>
            {text("expiresAt", "datetime-local")}
          </Field>
          <Field label={t("maxClicks")}>
            <input
              name="rule.maxClicks"
              type="number"
              min="0"
              step="1"
              value={values.maxClicks}
              onChange={(event) =>
                setValues((current) => ({
                  ...current,
                  maxClicks: event.target.value,
                }))
              }
              className={inputClass}
            />
          </Field>
          <p className="text-meta text-fg-muted">{t("approximate")}</p>
          <Field label={t("expiredUrl")}>{text("expiredUrl", "url")}</Field>
        </div>
      </details>
      {(["geo", "device", "rotation"] as const).map((kind) => (
        <details key={kind} open={error || undefined}>
          {summary(t(kind), t("rowCount", { count: rows[kind].length }))}
          <div className="flex min-w-0 flex-col gap-5 pb-5">
            <p className="text-small text-fg-muted">{t(`${kind}Help`)}</p>
            <input
              type="hidden"
              name={`rule.${kind}.count`}
              value={rows[kind].length}
            />
            {rows[kind].map((row, index) => (
              <fieldset
                key={row.id}
                className="flex min-w-0 flex-col gap-3 border-t border-line pt-4"
              >
                <legend className="text-small font-medium">
                  {t("row", { index: index + 1 })}
                </legend>
                {rowFields[kind].map((field) => (
                  <Field key={field} label={t(`fields.${field}`)}>
                    {field === "os" || field === "device" ? (
                      <select
                        name={`rule.${kind}.${index}.${field}`}
                        value={row.values[field] ?? ""}
                        onChange={(event) =>
                          updateRow(kind, row.id, field, event.target.value)
                        }
                        className={inputClass}
                      >
                        <option value="">{t("any")}</option>
                        {(field === "os"
                          ? (["ios", "android", "windows", "macos"] as const)
                          : (["mobile", "tablet", "desktop"] as const)
                        ).map((option) => (
                          <option key={option} value={option}>
                            {t(`options.${option}`)}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        name={`rule.${kind}.${index}.${field}`}
                        type={
                          field === "url"
                            ? "url"
                            : field === "weight"
                              ? "number"
                              : "text"
                        }
                        maxLength={field === "country" ? 2 : 2048}
                        min={field === "weight" ? "0.000001" : undefined}
                        max={field === "weight" ? "1000000" : undefined}
                        step={field === "weight" ? "any" : undefined}
                        value={row.values[field] ?? ""}
                        onChange={(event) =>
                          updateRow(kind, row.id, field, event.target.value)
                        }
                        className={inputClass}
                      />
                    )}
                  </Field>
                ))}
                <Button
                  type="button"
                  variant="secondary"
                  className="self-start"
                  aria-label={t("removeRow", { index: index + 1 })}
                  onClick={() =>
                    setRows((current) => ({
                      ...current,
                      [kind]: current[kind].filter(
                        (value) => value.id !== row.id,
                      ),
                    }))
                  }
                >
                  {t("remove")}
                </Button>
              </fieldset>
            ))}
            <Button
              type="button"
              variant="secondary"
              className="self-start"
              disabled={rows[kind].length >= 10}
              onClick={() =>
                setRows((current) => ({
                  ...current,
                  [kind]: [
                    ...current[kind],
                    {
                      id: crypto.randomUUID(),
                      values: kind === "rotation" ? { weight: "1" } : {},
                    },
                  ],
                }))
              }
            >
              {t("add")}
            </Button>
          </div>
        </details>
      ))}
      <details open={error || undefined}>
        {summary(
          t("deepLink"),
          values["deepLink.ios"] || values["deepLink.android"]
            ? t("deepLinkSet")
            : t("deepLinkNone"),
        )}
        <div className="flex flex-col gap-4 pb-5">
          <p className="text-small text-fg-muted">{t("deepLinkHelp")}</p>
          <Field label={t("iosApp")}>{text("deepLink.ios")}</Field>
          <Field label={t("androidApp")}>{text("deepLink.android")}</Field>
          <Field label={t("fallback")}>
            <select
              name="rule.deepLink.fallback"
              value={values["deepLink.fallback"]}
              onChange={(event) =>
                setValues((current) => ({
                  ...current,
                  "deepLink.fallback": event.target.value,
                }))
              }
              className={inputClass}
            >
              <option value="web">{t("webFallback")}</option>
              <option value="store">{t("storeFallback")}</option>
            </select>
          </Field>
          <Field label={t("iosStore")}>
            {text("deepLink.store.ios", "url")}
          </Field>
          <Field label={t("androidStore")}>
            {text("deepLink.store.android", "url")}
          </Field>
        </div>
      </details>
      <details open={error || undefined}>
        {summary(
          t("redirect"),
          t("redirectSummary", {
            query: forward ? t("on") : t("off"),
            permanent: permanent ? "301" : "302",
          }),
        )}
        <div className="flex flex-col gap-4 pb-5">
          <label className="flex items-start gap-2 text-small">
            <input
              type="checkbox"
              name="rule.forwardQuery"
              checked={forward}
              onChange={(event) => setForward(event.target.checked)}
              className="mt-0.5 size-4 shrink-0 accent-signal"
            />
            {t("forwardQuery")}
          </label>
          <label className="flex items-start gap-2 text-small">
            <input
              type="checkbox"
              name="rule.permanent"
              checked={permanent}
              onChange={(event) => setPermanent(event.target.checked)}
              className="mt-0.5 size-4 shrink-0 accent-signal"
            />
            {t("permanent")}
          </label>
          <p className="text-meta text-fg-muted">{t("permanentHelp")}</p>
          <p className="text-small text-fg-muted">{t("utmHelp")}</p>
          {(["source", "medium", "campaign", "term", "content"] as const).map(
            (key) => (
              <Field key={key} label={`utm_${key}`}>
                {text(`utm.${key}`, "text", 200)}
              </Field>
            ),
          )}
        </div>
      </details>
      <details open={error || undefined}>
        {summary(
          t("social"),
          Object.values(og).some(Boolean) ? t("socialSet") : t("socialNone"),
        )}
        <div className="flex flex-col gap-4 pb-5">
          <p className="text-small text-fg-muted">{t("socialHelp")}</p>
          {(["title", "description", "image"] as const).map((key) => (
            <Field key={key} label={t(`socialFields.${key}`)}>
              <input
                name={`og.${key}`}
                type={key === "image" ? "url" : "text"}
                value={og[key]}
                onChange={(event) =>
                  setOg((current) => ({
                    ...current,
                    [key]: event.target.value,
                  }))
                }
                maxLength={
                  key === "title" ? 200 : key === "description" ? 500 : 2048
                }
                className={inputClass}
              />
            </Field>
          ))}
        </div>
      </details>
    </fieldset>
  );
}
