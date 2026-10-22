"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { buttonVariants } from "@shortn/ui";
import { Section } from "@/components/page/page";
import { FormField, inputClass } from "@/components/page/form";
import { CopyButton } from "@/components/page/copy-button";
import {
  saveWebhookAction,
  webhookOperationAction,
  type WebhookActionResult,
} from "@/server/actions/webhooks";
export interface Endpoint {
  id: string;
  name: string;
  url: string;
  events: string[];
  enabled: boolean;
  failureSince: string | null;
  disabledAt: string | null;
  adminDisabled: { at: string; reason: string } | null;
}
const knownErrors = [
  "forbidden",
  "feature_disabled",
  "not_found",
  "endpoint_disabled",
  "invalid_input",
  "admin_disabled",
] as const;
export const eventNames = [
  "link.created",
  "link.updated",
  "link.deleted",
  "link.clicked",
  "qr.scanned",
  "bio.published",
  "domain.verified",
  "import.completed",
] as const;
export interface Delivery {
  id: string;
  eventId: string;
  type: string;
  status: string;
  attempts: number;
  createdAt: string;
  deliveredAt: string | null;
  lastStatus: number | null;
  lastError: string | null;
}
export function WebhookManager({
  workspace,
  items,
  enabled,
}: {
  workspace: string;
  items: Endpoint[];
  enabled: boolean;
}) {
  const t = useTranslations("settings.webhooks"),
    router = useRouter(),
    id = useId();
  const [pending, startTransition] = useTransition();
  const [editor, setEditor] = useState<Endpoint | "new" | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);
  const [secret, setSecret] = useState<{ value: string; name: string } | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null),
    [notice, setNotice] = useState<string | null>(null);
  const focus = useRef<HTMLHeadingElement>(null);
  const returnFocus = useRef<string | null>(null);
  useEffect(() => {
    if (editor || secret || confirm || pending || !returnFocus.current) return;
    const target =
      document.getElementById(returnFocus.current) ??
      document.getElementById(`${id}-create`);
    target?.focus();
  }, [editor, secret, confirm, pending, items, id]);
  useEffect(() => {
    function onIntent() {
      if (!editor && !secret && !confirm && !pending)
        returnFocus.current = null;
    }
    // Keep the request through server refreshes; only a new user gesture
    // supersedes it. Programmatic form autofocus must not clear the opener.
    document.addEventListener("pointerdown", onIntent, { passive: true });
    document.addEventListener("keydown", onIntent);
    return () => {
      document.removeEventListener("pointerdown", onIntent);
      document.removeEventListener("keydown", onIntent);
    };
  }, [editor, secret, confirm, pending]);
  useEffect(() => {
    if (secret) focus.current?.focus();
  }, [secret]);
  function mutate(action: () => Promise<WebhookActionResult>) {
    setError(null);
    setNotice(null);
    startTransition(async () => {
      try {
        const result = await action();
        if (!result.ok) {
          setError(
            t(
              `errors.${knownErrors.find((code) => code === result.error) ?? "failed"}`,
            ),
          );
          return;
        }
        if (result.notice === "deleted") returnFocus.current = `${id}-create`;
        setEditor(null);
        setConfirm(null);
        if (result.secret)
          setSecret({ value: result.secret, name: result.name ?? "" });
        else setNotice(t(`notices.${result.notice}`));
        router.refresh();
      } catch {
        setError(t("errors.failed"));
      }
    });
  }
  const editing = editor && editor !== "new" ? editor : null;
  return (
    <>
      {secret ? (
        <Section title={t("secretTitle")}>
          <div className="flex max-w-xl flex-col gap-4">
            <h3
              ref={focus}
              tabIndex={-1}
              className="text-body font-medium outline-none"
            >
              {secret.name}
            </h3>
            <p className="text-small text-fg-muted">{t("secretHelp")}</p>
            <code className="break-all rounded-control bg-bg-subtle p-3 text-small">
              {secret.value}
            </code>
            <div className="flex flex-wrap gap-2">
              <CopyButton
                value={secret.value}
                label={t("copy")}
                copiedLabel={t("copied")}
              />
              <button
                className={buttonVariants({ variant: "secondary" })}
                onClick={() => {
                  returnFocus.current = `${id}-create`;
                  setSecret(null);
                }}
              >
                {t("secretDone")}
              </button>
            </div>
          </div>
        </Section>
      ) : null}
      {!enabled ? (
        <p className="mb-5 text-small text-fg-muted">{t("disabledHelp")}</p>
      ) : null}
      {error ? (
        <p role="alert" className="mb-4 text-small text-danger">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p role="status" className="mb-4 text-small text-fg-muted">
          {notice}
        </p>
      ) : null}
      {editor ? (
        <Section title={t(editing ? "edit" : "create")}>
          <form
            className="flex max-w-xl flex-col gap-5"
            onSubmit={(event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              mutate(() =>
                saveWebhookAction(workspace, editing?.id ?? null, form),
              );
            }}
          >
            <fieldset
              disabled={pending || !enabled}
              className="flex min-w-0 flex-col gap-5"
            >
              <FormField id={`${id}-name`} label={t("name")}>
                <input
                  autoFocus
                  id={`${id}-name`}
                  className={inputClass}
                  name="name"
                  required
                  maxLength={100}
                  defaultValue={editing?.name ?? ""}
                />
              </FormField>
              <FormField id={`${id}-url`} label={t("url")}>
                <input
                  id={`${id}-url`}
                  className={inputClass}
                  type="url"
                  name="url"
                  required
                  maxLength={2048}
                  pattern="https://.*"
                  placeholder="https://example.com/webhooks"
                  defaultValue={editing?.url ?? ""}
                />
                <p className="mt-2 text-small text-fg-muted">{t("urlHelp")}</p>
              </FormField>
              <fieldset className="min-w-0">
                <legend className="mb-3 text-small font-medium">
                  {t("events")}
                </legend>
                <div className="grid gap-3 sm:grid-cols-2">
                  {eventNames.map((name) => (
                    <label
                      key={name}
                      className="flex min-w-0 items-start gap-2 text-small"
                    >
                      <input
                        className="mt-0.5 accent-fg"
                        type="checkbox"
                        name="events"
                        value={name}
                        defaultChecked={
                          editing
                            ? editing.events.includes(name)
                            : name === "link.created"
                        }
                      />
                      <span className="break-all">{name}</span>
                    </label>
                  ))}
                </div>
                <p className="mt-3 text-small text-fg-muted">
                  {t("eventsHelp")}
                </p>
              </fieldset>
              <label className="flex items-center gap-2 text-small">
                <input
                  type="checkbox"
                  name="enabled"
                  defaultChecked={editing?.enabled ?? true}
                  className="accent-fg"
                />
                {t("enabled")}
              </label>
            </fieldset>
            <div className="flex flex-wrap gap-2">
              <button
                disabled={pending || !enabled}
                className={buttonVariants({ variant: "primary" })}
                type="submit"
              >
                {t(pending ? "saving" : "save")}
              </button>
              <button
                disabled={pending}
                className={buttonVariants({ variant: "secondary" })}
                type="button"
                onClick={() => {
                  setEditor(null);
                  setError(null);
                }}
              >
                {t("cancel")}
              </button>
            </div>
          </form>
        </Section>
      ) : (
        <Section title={t("endpoints")} anchor="webhooks-endpoints">
          <div className="mb-5 flex flex-wrap items-center gap-3">
            <button
              id={`${id}-create`}
              disabled={pending || !enabled || Boolean(secret)}
              className={buttonVariants({ variant: "primary" })}
              onClick={() => {
                returnFocus.current = `${id}-create`;
                setEditor("new");
                setError(null);
                setNotice(null);
              }}
            >
              {t("create")}
            </button>
          </div>
          {items.length ? (
            <ul className="divide-y divide-line">
              {items.map((item) => (
                <li
                  key={item.id}
                  className="flex min-w-0 flex-col gap-3 py-5 first:pt-0"
                >
                  <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <h3
                        className="truncate text-body font-medium"
                        title={item.name}
                      >
                        {item.name}
                      </h3>
                      <p
                        title={item.url}
                        className="mt-1 line-clamp-2 break-all text-small text-fg-muted"
                      >
                        {item.url}
                      </p>
                    </div>
                    <span className="text-small text-fg-muted">
                      {t(
                        item.adminDisabled
                          ? "adminDisabled"
                          : item.enabled
                            ? "active"
                            : item.disabledAt
                              ? "autoDisabled"
                              : "inactive",
                      )}
                    </span>
                  </div>
                  {item.adminDisabled ? (
                    <p className="text-small text-danger">
                      {t("adminDisabledNotice", {
                        reason: item.adminDisabled.reason,
                      })}
                    </p>
                  ) : null}
                  <p className="break-words text-small text-fg-muted">
                    {item.events.join(", ")}
                  </p>
                  {item.failureSince ? (
                    <p className="text-small text-danger">{t("failing")}</p>
                  ) : null}
                  <div className="flex flex-wrap gap-2">
                    <Link
                      className={buttonVariants({ variant: "secondary" })}
                      href={`/${workspace}/settings/webhooks/${item.id}`}
                    >
                      {t("deliveries")}
                    </Link>
                    <button
                      id={`${id}-edit-${item.id}`}
                      disabled={pending || !enabled || Boolean(secret)}
                      className={buttonVariants({ variant: "secondary" })}
                      onClick={() => {
                        returnFocus.current = `${id}-edit-${item.id}`;
                        setEditor(item);
                        setError(null);
                      }}
                    >
                      {t("edit")}
                    </button>
                    <button
                      disabled={pending || !enabled}
                      className={buttonVariants({ variant: "secondary" })}
                      onClick={() =>
                        mutate(() =>
                          webhookOperationAction(
                            workspace,
                            item.id,
                            item.enabled ? "disable" : "enable",
                          ),
                        )
                      }
                    >
                      {t(item.enabled ? "disable" : "enable")}
                    </button>
                    <button
                      disabled={pending || !enabled || !item.enabled}
                      className={buttonVariants({ variant: "secondary" })}
                      onClick={() =>
                        mutate(() =>
                          webhookOperationAction(workspace, item.id, "test"),
                        )
                      }
                    >
                      {t("test")}
                    </button>
                    <button
                      id={`${id}-delete-${item.id}`}
                      disabled={pending}
                      className={buttonVariants({ variant: "ghost" })}
                      onClick={() => {
                        returnFocus.current = `${id}-delete-${item.id}`;
                        setConfirm(item.id);
                        setError(null);
                      }}
                    >
                      {t("delete")}
                    </button>
                  </div>
                  {confirm === item.id ? (
                    <div className="flex flex-wrap items-center gap-3 rounded-control bg-bg-subtle p-3">
                      <p className="min-w-0 basis-full break-words text-small [overflow-wrap:anywhere]">
                        {t("deleteConfirm", { name: item.name })}
                      </p>
                      <button
                        disabled={pending}
                        autoFocus
                        className={buttonVariants({ variant: "danger" })}
                        onClick={() =>
                          mutate(() =>
                            webhookOperationAction(
                              workspace,
                              item.id,
                              "delete",
                            ),
                          )
                        }
                      >
                        {t("delete")}
                      </button>
                      <button
                        disabled={pending}
                        className={buttonVariants({ variant: "secondary" })}
                        onClick={() => setConfirm(null)}
                      >
                        {t("cancel")}
                      </button>
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-small text-fg-muted">{t("empty")}</p>
          )}
        </Section>
      )}
    </>
  );
}
export function DeliveryLog({
  workspace,
  endpoint,
  items,
  enabled,
}: {
  workspace: string;
  endpoint: Endpoint;
  items: Delivery[];
  enabled: boolean;
}) {
  const t = useTranslations("settings.webhooks"),
    f = useFormatter(),
    router = useRouter();
  const [pending, startTransition] = useTransition(),
    [error, setError] = useState<string | null>(null),
    [queued, setQueued] = useState(false);
  return (
    <Section title={t("deliveries")}>
      <p className="mb-4 break-all text-small text-fg-muted">{endpoint.url}</p>
      <p className="mb-4 text-small text-fg-muted">{t("retention")}</p>
      <button
        disabled={pending}
        className={buttonVariants({ variant: "secondary" })}
        onClick={() => router.refresh()}
      >
        {t("refresh")}
      </button>
      {error ? (
        <p role="alert" className="mt-3 text-small text-danger">
          {error}
        </p>
      ) : null}
      {queued ? (
        <p role="status" className="mt-3 text-small text-fg-muted">
          {t("notices.queued")}
        </p>
      ) : null}
      {items.length ? (
        <ul className="mt-5 divide-y divide-line">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex min-w-0 flex-wrap items-start justify-between gap-3 py-4"
            >
              <div className="min-w-0 flex-1">
                <h3 className="break-all text-small font-medium">
                  {item.type}
                </h3>
                <p className="mt-1 text-small text-fg-muted">
                  {f.dateTime(new Date(item.createdAt), {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </p>
                <p className="mt-1 text-small text-fg-muted">
                  {t(
                    `statuses.${item.status as "pending" | "sending" | "delivered" | "failed" | "cancelled"}`,
                  )}{" "}
                  · {t("attempts", { count: item.attempts })}
                  {item.lastStatus ? ` · HTTP ${item.lastStatus}` : ""}
                </p>
                {item.lastError ? (
                  <p className="mt-1 break-all text-small text-danger">
                    {item.lastError}
                  </p>
                ) : null}
                <p className="mt-2 break-all text-small text-fg-muted">
                  {t("eventId")}: <code>{item.eventId}</code>
                </p>
              </div>
              <button
                disabled={pending || !enabled || !endpoint.enabled}
                className={buttonVariants({ variant: "secondary" })}
                onClick={() => {
                  setError(null);
                  setQueued(false);
                  startTransition(async () => {
                    try {
                      const result = await webhookOperationAction(
                        workspace,
                        endpoint.id,
                        "redeliver",
                        item.id,
                      );
                      if (!result.ok)
                        setError(
                          t(
                            result.error === "endpoint_disabled"
                              ? "errors.endpoint_disabled"
                              : "errors.failed",
                          ),
                        );
                      else {
                        setQueued(true);
                        router.refresh();
                      }
                    } catch {
                      setError(t("errors.failed"));
                    }
                  });
                }}
              >
                {t("redeliver")}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-5 text-small text-fg-muted">{t("noDeliveries")}</p>
      )}
    </Section>
  );
}
