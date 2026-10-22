"use client";

import { authClient } from "@shortn/auth/client";
import { Button, Input } from "@shortn/ui";
import { useTranslations } from "next-intl";
import { useRef, useState, type FormEvent } from "react";
import { AuthField } from "./auth-field";
import { AuthHeading } from "./auth-parts";

const errorKeys = {
  TOTP_ALREADY_USED: "used",
  INVALID_CODE: "invalid",
  TOO_MANY_ATTEMPTS: "locked",
} as const;

/** Staff step-up for the admin console: a fresh authenticator code buys a
 * 60-second token that only the admin console can redeem. */
export function AdminElevateForm({
  nonceHash,
  purpose,
}: {
  nonceHash: string;
  purpose: "login" | "stepup";
}) {
  const t = useTranslations("auth.adminElevate");
  const [code, setCode] = useState(""),
    [pending, setPending] = useState(false),
    [error, setError] = useState("");
  const busy = useRef(false),
    input = useRef<HTMLInputElement>(null);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy.current) return;
    const value = code.trim();
    if (!/^\d{6}$/.test(value)) {
      setError(t("codeInvalid"));
      input.current?.focus();
      return;
    }
    busy.current = true;
    setPending(true);
    setError("");
    try {
      const result = await authClient.$fetch<{ url: string }>(
        "/admin/elevate",
        {
          method: "POST",
          body: { code: value, n: nonceHash, purpose },
        },
      );
      if (result.data) {
        window.location.assign(result.data.url);
        return;
      }
      const errorCode =
        result.error && "code" in result.error ? result.error.code : "";
      const key =
        Object.entries(errorKeys).find(([name]) => name === errorCode)?.[1] ??
        (result.error?.status === 429 ? "locked" : "refused");
      setError(t(key));
      input.current?.focus();
    } catch {
      setError(t("network"));
    }
    busy.current = false;
    setPending(false);
  }
  return (
    <>
      <AuthHeading
        title={t(purpose === "login" ? "title" : "stepUpTitle")}
        description={t("help")}
      />
      <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
        <AuthField
          id="admin-elevate-code"
          label={t("codeLabel")}
          error={error || undefined}
        >
          {(control) => (
            <Input
              {...control}
              ref={input}
              name="code"
              value={code}
              onChange={(event) => {
                setCode(event.target.value);
                setError("");
              }}
              size="lg"
              autoFocus
              disabled={pending}
              autoComplete="one-time-code"
              inputMode="numeric"
              spellCheck={false}
              maxLength={6}
            />
          )}
        </AuthField>
        <Button
          type="submit"
          variant="primary"
          size="lg"
          loading={pending}
          disabled={pending}
        >
          {t("submit")}
        </Button>
      </form>
    </>
  );
}
