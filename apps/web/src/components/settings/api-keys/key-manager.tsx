"use client";

import type { PlanId } from "@shortn/billing";
import { apiScopes, type ApiScope } from "@shortn/core/api-scopes";
import { buttonVariants, cn } from "@shortn/ui";
import { useFormatter, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, useTransition } from "react";
import { CopyButton } from "@/components/page/copy-button";
import { FormField, inputClass } from "@/components/page/form";
import { Section } from "@/components/page/page";
import { PlanGate } from "@/components/plan-gate";
import {
  createApiKeyAction,
  revokeApiKeyAction,
  rollApiKeyAction,
  type ApiKeyActionResult,
} from "@/server/actions/api-keys";

export interface ApiKeyListItem {
  id: string;
  name: string;
  prefix: string;
  scopes: string[];
  ipAllowlist: string[];
  createdAt: string;
  lastUsedAt: string | null;
  expiresAt: string | null;
  revokedAt: string | null;
  expired: boolean;
}
const resources = [
  "links",
  "analytics",
  "qr",
  "bio",
  "domains",
  "webhooks",
  "tags",
  "campaigns",
  "workspace",
] as const;

export function ApiKeyManager({
  workspace,
  items,
  enabled,
  gate,
  today,
}: {
  workspace: string;
  items: ApiKeyListItem[];
  enabled: boolean;
  /** Cheapest plan with API access, or null when this workspace has it. */
  gate: PlanId | null;
  today: string;
}) {
  const t = useTranslations("settings.apiKeys"),
    f = useFormatter(),
    router = useRouter(),
    id = useId();
  const [pending, startTransition] = useTransition();
  const [creating, setCreating] = useState(false);
  const [values, setValues] = useState({
    name: "",
    expiresOn: "",
    ipAllowlist: "",
  });
  const [scopes, setScopes] = useState<ApiScope[]>(["links:read"]);
  const [error, setError] = useState<{
    message: string;
    field?: string;
  } | null>(null);
  const [secret, setSecret] = useState<{ value: string; name: string } | null>(
    null,
  );
  const [confirm, setConfirm] = useState<{
    id: string;
    operation: "roll" | "revoke";
  } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const secretHeading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (secret) secretHeading.current?.focus();
  }, [secret]);

  function mutate(action: () => Promise<ApiKeyActionResult>) {
    setError(null);
    setNotice(null);
    startTransition(async () => {
      try {
        const result = await action();
        if (!result.ok) {
          setError({
            message: t(
              `errors.${result.error === "invalid_expiry" ? "invalid_expiry" : result.error === "invalid_input" ? (result.field === "name" ? "invalid_name" : result.field === "scopes" ? "invalid_scopes" : result.field === "ipAllowlist" ? "invalid_ips" : "invalid_input") : result.error === "forbidden" ? "forbidden" : result.error === "disabled" ? "disabled" : result.error === "feature_required" ? "feature_required" : result.error === "not_found" ? "not_found" : "failed"}`,
            ),
            ...(result.field ? { field: result.field } : {}),
          });
          return;
        }
        setConfirm(null);
        setCreating(false);
        if (result.secret) {
          setSecret({ value: result.secret, name: result.name ?? "" });
          setValues({ name: "", expiresOn: "", ipAllowlist: "" });
          setScopes(["links:read"]);
        } else setNotice(t("revokedNotice"));
        router.refresh();
      } catch {
        setError({ message: t("errors.failed") });
      }
    });
  }
  const clearFieldError = (field: string) =>
    setError((current) => (current?.field === field ? null : current));
  const fieldError = (field: string) =>
    error?.field === field ? error.message : undefined;
  const date = (value: string) =>
    f.dateTime(new Date(value), { dateStyle: "medium", timeZone: "UTC" });

  return (
    <>
      {secret ? (
        <Section title={t("secretTitle")}>
          <div className="flex max-w-xl flex-col gap-4">
            <h3
              ref={secretHeading}
              tabIndex={-1}
              className="text-body font-medium focus-visible:outline-2 focus-visible:outline-signal"
            >
              {t("secretFor", { name: secret.name })}
            </h3>
            <p className="text-small text-fg-muted">{t("secretHint")}</p>
            <label htmlFor={`${id}-secret`} className="sr-only">
              {t("secretLabel")}
            </label>
            <input
              id={`${id}-secret`}
              readOnly
              value={secret.value}
              spellCheck={false}
              autoComplete="off"
              className={cn(inputClass, "font-mono text-small")}
              onFocus={(event) => event.currentTarget.select()}
            />
            <div className="flex flex-wrap gap-2">
              <CopyButton
                value={secret.value}
                label={t("copy")}
                copiedLabel={t("copied")}
              />
              <button
                type="button"
                className={buttonVariants({ variant: "primary", size: "md" })}
                onClick={() => {
                  setSecret(null);
                  setNotice(t("secretDismissed"));
                }}
              >
                {t("done")}
              </button>
            </div>
          </div>
        </Section>
      ) : null}
      {notice ? (
        <p role="status" className="mb-4 text-small text-fg-muted">
          {notice}
        </p>
      ) : null}
      {error && !error.field ? (
        <p role="alert" className="mb-4 text-small text-danger">
          {error.message}
        </p>
      ) : null}
      {!enabled ? (
        <p className="mb-6 text-small text-fg-muted">{t("disabled")}</p>
      ) : null}
      {!secret && enabled && gate ? (
        <Section
          title={t("createTitle")}
          description={t("createHint")}
          anchor="api-keys-create"
        >
          <div className="flex flex-col items-start gap-3">
            <button
              type="button"
              disabled
              aria-describedby={`${id}-gate`}
              className={buttonVariants({ variant: "primary", size: "md" })}
            >
              {t("create")}
            </button>
            <PlanGate id={`${id}-gate`} feature="api" plan={gate} />
          </div>
        </Section>
      ) : null}
      {!secret && enabled && !gate ? (
        <Section
          title={t("createTitle")}
          description={t("createHint")}
          anchor="api-keys-create"
        >
          {!creating ? (
            <button
              type="button"
              className={buttonVariants({ variant: "primary", size: "md" })}
              onClick={() => {
                setCreating(true);
                setError(null);
              }}
            >
              {t("create")}
            </button>
          ) : (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                const form = new FormData(event.currentTarget);
                mutate(() => createApiKeyAction(workspace, form));
              }}
              noValidate
              className="flex max-w-xl flex-col gap-5"
              aria-busy={pending}
            >
              <fieldset disabled={pending} className="contents">
                <FormField
                  id={`${id}-name`}
                  label={t("name")}
                  hint={t("nameHint")}
                  error={fieldError("name")}
                >
                  <input
                    id={`${id}-name`}
                    name="name"
                    required
                    maxLength={100}
                    value={values.name}
                    onChange={(event) => {
                      setValues({ ...values, name: event.target.value });
                      clearFieldError("name");
                    }}
                    className={inputClass}
                    aria-invalid={Boolean(fieldError("name"))}
                    aria-describedby={`${id}-name-${fieldError("name") ? "error" : "hint"}`}
                    autoComplete="off"
                  />
                </FormField>
                <fieldset
                  className="min-w-0"
                  aria-describedby={`${id}-scopes-hint`}
                >
                  <legend className="text-small font-medium">
                    {t("scopes")}
                  </legend>
                  <p
                    id={`${id}-scopes-hint`}
                    className="mt-1 text-small text-fg-muted"
                  >
                    {t("scopesHint")}
                  </p>
                  <div className="mt-3 divide-y divide-line border-y border-line">
                    {resources.map((resource) => (
                      <div
                        key={resource}
                        className="flex flex-wrap items-center justify-between gap-x-5 gap-y-2 py-2.5"
                      >
                        <span className="min-w-0 flex-1 text-small">
                          {t(`resources.${resource}`)}
                        </span>
                        <div className="flex gap-4">
                          {(["read", "write"] as const).map((operation) => {
                            const scope = apiScopes.find(
                              (candidate) =>
                                candidate === `${resource}:${operation}`,
                            );
                            return scope ? (
                              <label
                                key={operation}
                                className="flex min-h-9 cursor-pointer items-center gap-2 text-small"
                              >
                                <input
                                  type="checkbox"
                                  name="scopes"
                                  value={scope}
                                  checked={scopes.includes(scope)}
                                  onChange={(event) => {
                                    const checked = event.target.checked;
                                    clearFieldError("scopes");
                                    setScopes((current) =>
                                      checked
                                        ? [...current, scope]
                                        : current.filter(
                                            (item) => item !== scope,
                                          ),
                                    );
                                  }}
                                  className="size-4 accent-primary"
                                  aria-label={t("scopeLabel", {
                                    resource: t(`resources.${resource}`),
                                    operation: t(operation),
                                  })}
                                />
                                {t(operation)}
                              </label>
                            ) : null;
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                  {fieldError("scopes") ? (
                    <p role="alert" className="mt-2 text-small text-danger">
                      {fieldError("scopes")}
                    </p>
                  ) : null}
                </fieldset>
                <FormField
                  id={`${id}-expires`}
                  label={t("expiresOn")}
                  hint={t("expiresHint")}
                  error={fieldError("expiresOn")}
                  optional={t("optional")}
                >
                  <input
                    id={`${id}-expires`}
                    name="expiresOn"
                    type="date"
                    min={new Date(new Date(today).getTime() + 86_400_000)
                      .toISOString()
                      .slice(0, 10)}
                    value={values.expiresOn}
                    onChange={(event) => {
                      setValues({ ...values, expiresOn: event.target.value });
                      clearFieldError("expiresOn");
                    }}
                    className={inputClass}
                    aria-invalid={Boolean(fieldError("expiresOn"))}
                    aria-describedby={`${id}-expires-${fieldError("expiresOn") ? "error" : "hint"}`}
                  />
                </FormField>
                <FormField
                  id={`${id}-ips`}
                  label={t("ipAllowlist")}
                  hint={t("ipsHint")}
                  error={fieldError("ipAllowlist")}
                  optional={t("optional")}
                >
                  <textarea
                    id={`${id}-ips`}
                    name="ipAllowlist"
                    rows={3}
                    maxLength={5000}
                    value={values.ipAllowlist}
                    onChange={(event) => {
                      setValues({ ...values, ipAllowlist: event.target.value });
                      clearFieldError("ipAllowlist");
                    }}
                    className={cn(
                      inputClass,
                      "h-auto min-h-24 py-2 font-mono text-small",
                    )}
                    spellCheck={false}
                    autoComplete="off"
                    aria-invalid={Boolean(fieldError("ipAllowlist"))}
                    aria-describedby={`${id}-ips-${fieldError("ipAllowlist") ? "error" : "hint"}`}
                  />
                </FormField>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="submit"
                    disabled={pending}
                    className={buttonVariants({
                      variant: "primary",
                      size: "md",
                    })}
                  >
                    {pending ? t("saving") : t("create")}
                  </button>
                  <button
                    type="button"
                    disabled={pending}
                    className={buttonVariants({ variant: "ghost", size: "md" })}
                    onClick={() => {
                      setCreating(false);
                      setError(null);
                    }}
                  >
                    {t("cancel")}
                  </button>
                </div>
              </fieldset>
            </form>
          )}
        </Section>
      ) : null}
      <Section title={t("listTitle")} description={t("listHint")}>
        {items.length === 0 ? (
          <p className="py-6 text-small text-fg-muted">{t("empty")}</p>
        ) : (
          <ul className="divide-y divide-line border-y border-line">
            {items.map((key) => {
              const expired = key.expired;
              const active = !key.revokedAt && !expired;
              const selected = confirm?.id === key.id;
              return (
                <li key={key.id} className="py-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1 basis-56">
                      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                        <h3
                          className="max-w-full truncate text-small font-medium"
                          title={key.name}
                        >
                          {key.name}
                        </h3>
                        <span className="text-meta text-fg-muted">
                          {key.revokedAt
                            ? t("revoked")
                            : expired
                              ? t("expired")
                              : t("active")}
                        </span>
                      </div>
                      <p className="mt-1 font-mono text-small text-fg-muted">
                        {key.prefix}
                      </p>
                      <p className="mt-2 text-meta text-fg-muted">
                        {t("created", { date: date(key.createdAt) })} ·{" "}
                        {key.lastUsedAt
                          ? t("lastUsed", { date: date(key.lastUsedAt) })
                          : t("neverUsed")}
                      </p>
                      {key.expiresAt ? (
                        <p className="mt-1 text-meta text-fg-muted">
                          {t("expires", { date: date(key.expiresAt) })}
                        </p>
                      ) : null}
                      <details className="mt-2 text-small">
                        <summary className="min-h-9 cursor-pointer text-fg-muted hover:text-fg">
                          {t("permissions", { count: key.scopes.length })}
                        </summary>
                        <p className="mt-1 break-words font-mono text-meta text-fg-muted">
                          {key.scopes.join(", ")}
                        </p>
                        {key.ipAllowlist.length ? (
                          <p className="mt-2 break-words font-mono text-meta text-fg-muted">
                            {key.ipAllowlist.join(", ")}
                          </p>
                        ) : null}
                      </details>
                    </div>
                    {active && !secret ? (
                      <div className="flex flex-wrap gap-1">
                        {enabled ? (
                          <button
                            type="button"
                            disabled={pending}
                            className={buttonVariants({
                              variant: "ghost",
                              size: "md",
                            })}
                            onClick={() => {
                              setConfirm({ id: key.id, operation: "roll" });
                              setError(null);
                            }}
                          >
                            {t("roll")}
                          </button>
                        ) : null}
                        <button
                          type="button"
                          disabled={pending}
                          className={buttonVariants({
                            variant: "dangerGhost",
                            size: "md",
                          })}
                          onClick={() => {
                            setConfirm({ id: key.id, operation: "revoke" });
                            setError(null);
                          }}
                        >
                          {t("revoke")}
                        </button>
                      </div>
                    ) : null}
                  </div>
                  {selected && !secret ? (
                    <div
                      className="mt-3 flex flex-col gap-3 rounded-control bg-bg-subtle p-3"
                      role="group"
                      aria-label={t(
                        confirm.operation === "roll" ? "roll" : "revoke",
                      )}
                    >
                      <p className="text-small">
                        {t(
                          confirm.operation === "roll"
                            ? "rollHint"
                            : "revokeHint",
                          { name: key.name },
                        )}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={pending}
                          aria-busy={pending}
                          className={buttonVariants({
                            variant: "danger",
                            size: "md",
                          })}
                          onClick={() =>
                            mutate(() =>
                              confirm.operation === "roll"
                                ? rollApiKeyAction(workspace, key.id)
                                : revokeApiKeyAction(workspace, key.id),
                            )
                          }
                        >
                          {pending
                            ? t("saving")
                            : t(
                                confirm.operation === "roll"
                                  ? "confirmRoll"
                                  : "confirmRevoke",
                              )}
                        </button>
                        <button
                          type="button"
                          disabled={pending}
                          className={buttonVariants({
                            variant: "ghost",
                            size: "md",
                          })}
                          onClick={() => setConfirm(null)}
                        >
                          {t("cancel")}
                        </button>
                      </div>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </Section>
    </>
  );
}
