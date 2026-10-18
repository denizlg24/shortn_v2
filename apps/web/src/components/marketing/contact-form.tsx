"use client";

import { buttonVariants, cn } from "@shortn/ui";
import { useTranslations } from "next-intl";
import { useCallback, useId, useRef, useState, type FormEvent } from "react";
import {
  contactLimits,
  contactTopics,
  type ContactTopic,
} from "@/lib/marketing/contact";
import { useTurnstile } from "./turnstile";

type FieldError =
  "nameRequired" | "emailInvalid" | "messageShort" | "messageLong";
type FormError = "challenge" | "rateLimited" | "failed";

const supportEmail = "support@shortn.at";

const field =
  "w-full rounded-control border border-line-strong bg-field px-3 text-emphasis text-fg outline-none placeholder:text-fg-subtle focus-visible:border-signal focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-signal aria-invalid:border-danger";

export function ContactForm({
  locale,
  siteKey,
}: {
  locale: string;
  siteKey: string | null;
}) {
  const t = useTranslations("marketing.contact.form");
  const [values, setValues] = useState({
    name: "",
    email: "",
    company: "",
    topic: "sales" as ContactTopic,
    message: "",
    website: "",
  });
  const [errors, setErrors] = useState<
    Partial<Record<"name" | "email" | "message", FieldError>>
  >({});
  const [formError, setFormError] = useState<FormError | null>(null);
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState<{ email: string; reference: string } | null>(
    null,
  );
  const widget = useRef<HTMLDivElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const id = useId();
  const challengeFailed = useCallback(() => setFormError("challenge"), []);
  const [engaged, setEngaged] = useState(false);
  const turnstile = useTurnstile(
    widget,
    { siteKey: engaged ? siteKey : null, action: "contact", locale },
    challengeFailed,
  );

  function validate() {
    const next: typeof errors = {};
    if (!values.name.trim()) next.name = "nameRequired";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim()))
      next.email = "emailInvalid";
    const length = values.message.trim().length;
    if (length < contactLimits.messageMin) next.message = "messageShort";
    else if (length > contactLimits.messageMax) next.message = "messageLong";
    setErrors(next);
    const first = (["name", "email", "message"] as const).find(
      (key) => next[key],
    );
    if (first) document.getElementById(`${id}-${first}`)?.focus();
    return !first;
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (pending || !validate()) return;
    setEngaged(true);
    setPending(true);
    setFormError(null);
    const token = await turnstile.token();
    if (!token) {
      setFormError("challenge");
      setPending(false);
      return;
    }
    try {
      const response = await fetch(`/${locale}/contact/send`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...values,
          company: values.company.trim() || undefined,
          token,
        }),
      });
      const body: unknown = await response.json().catch(() => null);
      if (
        response.ok &&
        body &&
        typeof body === "object" &&
        "reference" in body &&
        typeof body.reference === "string"
      ) {
        setSent({ email: values.email.trim(), reference: body.reference });
        requestAnimationFrame(() => heading.current?.focus());
      } else {
        const code =
          body && typeof body === "object" && "error" in body
            ? body.error
            : null;
        setFormError(
          code === "challenge" || code === "rateLimited" ? code : "failed",
        );
      }
    } catch {
      setFormError("failed");
    } finally {
      setPending(false);
      turnstile.reset();
    }
  }

  if (sent)
    return (
      <div className="flex flex-col items-start gap-4 border-t border-line pt-8">
        <h2
          ref={heading}
          tabIndex={-1}
          className="font-display text-headline font-extrabold tracking-[-0.03em] outline-none"
        >
          {t("success.title")}
        </h2>
        <p className="max-w-[52ch] text-lede text-pretty text-fg-muted">
          {t("success.body", { email: sent.email, reference: sent.reference })}
        </p>
        <button
          type="button"
          onClick={() => {
            setSent(null);
            setValues((current) => ({ ...current, message: "" }));
          }}
          className={cn(buttonVariants({ size: "lg" }), "h-11 px-4")}
        >
          {t("success.another")}
        </button>
      </div>
    );

  const set =
    (key: keyof typeof values) => (event: { target: { value: string } }) => {
      setValues((current) => ({ ...current, [key]: event.target.value }));
      if (key in errors)
        setErrors((current) => ({ ...current, [key]: undefined }));
    };
  const errorText = (key: "name" | "email" | "message") =>
    errors[key] ? (
      <p id={`${id}-${key}-error`} className="text-small text-danger">
        {t(`errors.${errors[key]}`, {
          min: contactLimits.messageMin,
          max: contactLimits.messageMax,
        })}
      </p>
    ) : null;
  const described = (key: "name" | "email" | "message", extra?: string) =>
    [errors[key] ? `${id}-${key}-error` : null, extra]
      .filter(Boolean)
      .join(" ") || undefined;
  const length = values.message.trim().length;

  return (
    <form
      onSubmit={submit}
      onFocusCapture={() => setEngaged(true)}
      noValidate
      className="flex flex-col gap-5"
    >
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${id}-name`} className="text-small font-medium">
            {t("name")}
          </label>
          <input
            id={`${id}-name`}
            autoComplete="name"
            value={values.name}
            onChange={set("name")}
            aria-invalid={Boolean(errors.name) || undefined}
            aria-describedby={described("name")}
            className={cn(field, "h-11")}
          />
          {errorText("name")}
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${id}-email`} className="text-small font-medium">
            {t("email")}
          </label>
          <input
            id={`${id}-email`}
            type="email"
            autoComplete="email"
            inputMode="email"
            spellCheck={false}
            value={values.email}
            onChange={set("email")}
            aria-invalid={Boolean(errors.email) || undefined}
            aria-describedby={described("email")}
            className={cn(field, "h-11")}
          />
          {errorText("email")}
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${id}-company`} className="text-small font-medium">
            {t("company")}{" "}
            <span className="font-normal text-fg-subtle">{t("optional")}</span>
          </label>
          <input
            id={`${id}-company`}
            autoComplete="organization"
            value={values.company}
            onChange={set("company")}
            className={cn(field, "h-11")}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${id}-topic`} className="text-small font-medium">
            {t("topic")}
          </label>
          <select
            id={`${id}-topic`}
            value={values.topic}
            onChange={set("topic")}
            className={cn(field, "h-11 pr-8")}
          >
            {contactTopics.map((topic) => (
              <option key={topic} value={topic}>
                {t(`topics.${topic}`)}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${id}-message`} className="text-small font-medium">
          {t("message")}
        </label>
        <textarea
          id={`${id}-message`}
          rows={7}
          value={values.message}
          onChange={set("message")}
          aria-invalid={Boolean(errors.message) || undefined}
          aria-describedby={described("message", `${id}-message-hint`)}
          className={cn(field, "min-h-40 resize-y py-2.5 leading-6")}
        />
        <div className="flex items-start justify-between gap-4">
          {errorText("message") ?? <span />}
          <p
            id={`${id}-message-hint`}
            className={cn(
              "shrink-0 font-mono text-meta tabular-nums text-fg-subtle",
              length > contactLimits.messageMax && "text-danger",
            )}
          >
            {t("messageHint", { count: length, max: contactLimits.messageMax })}
          </p>
        </div>
      </div>
      <div className="sr-only" aria-hidden>
        <label htmlFor={`${id}-website`}>Website</label>
        <input
          id={`${id}-website`}
          tabIndex={-1}
          autoComplete="off"
          value={values.website}
          onChange={set("website")}
        />
      </div>
      <div ref={widget} />
      {formError ? (
        <p role="alert" className="text-body text-pretty text-danger">
          {t(`errors.${formError}`, { email: supportEmail })}
        </p>
      ) : null}
      <button
        type="submit"
        aria-disabled={pending}
        className={cn(
          buttonVariants({ variant: "primary", size: "lg" }),
          "h-11 self-start px-5",
        )}
      >
        {pending ? t("submitting") : t("submit")}
      </button>
    </form>
  );
}
