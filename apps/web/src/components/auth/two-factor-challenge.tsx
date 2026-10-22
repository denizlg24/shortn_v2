"use client";

import { authClient } from "@shortn/auth/client";
import { Button, Input } from "@shortn/ui";
import { useTranslations } from "next-intl";
import { useRef, useState, type FormEvent } from "react";
import { AuthField } from "./auth-field";
import { AuthHeading } from "./auth-parts";

export function TwoFactorChallenge({ next }: { next: string }) {
  const t = useTranslations("auth.twoFactor"),
    [backup, setBackup] = useState(false);
  const [code, setCode] = useState(""),
    [pending, setPending] = useState(false),
    [error, setError] = useState("");
  const busy = useRef(false),
    input = useRef<HTMLInputElement>(null);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy.current) return;
    const value = code.trim();
    if (
      backup
        ? !/^[A-Za-z0-9]{5}-[A-Za-z0-9]{5}$/.test(value)
        : !/^\d{6}$/.test(value)
    ) {
      setError(t(backup ? "backupInvalid" : "codeInvalid"));
      input.current?.focus();
      return;
    }
    busy.current = true;
    setPending(true);
    setError("");
    try {
      const result = backup
        ? await authClient.twoFactor.verifyBackupCode({ code: value })
        : await authClient.twoFactor.verifyTotp({ code: value });
      if (result.error) {
        const key =
          result.error.code === "TOTP_ALREADY_USED"
            ? "used"
            : result.error.code === "ACCOUNT_SUSPENDED"
              ? "suspended"
              : result.error.code === "INVALID_TWO_FACTOR_COOKIE"
                ? "expired"
                : result.error.status === 429 ||
                    result.error.code === "ACCOUNT_TEMPORARILY_LOCKED"
                  ? "locked"
                  : "invalid";
        setError(t(key));
        input.current?.focus();
      } else {
        // OAuth's client hook follows its signed continuation. Ordinary login
        // and handoff land on the sanitized same-app destination.
        if (!new URLSearchParams(window.location.search).has("sig"))
          window.location.assign(next);
        return;
      }
    } catch {
      setError(t("network"));
    }
    busy.current = false;
    setPending(false);
  }
  function switchMethod() {
    setBackup((value) => !value);
    setCode("");
    setError("");
    requestAnimationFrame(() => input.current?.focus());
  }
  return (
    <>
      <AuthHeading
        title={t("title")}
        description={t(backup ? "backupHelp" : "help")}
      />
      <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
        <AuthField
          id="second-factor-code"
          label={t(backup ? "backupLabel" : "codeLabel")}
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
              inputMode={backup ? "text" : "numeric"}
              autoCapitalize="none"
              spellCheck={false}
              maxLength={backup ? 11 : 6}
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
        <Button
          type="button"
          variant="ghost"
          disabled={pending}
          onClick={switchMethod}
        >
          {t(backup ? "useAuthenticator" : "useBackup")}
        </Button>
      </form>
      <Button
        type="button"
        variant="ghost"
        className="mt-5"
        disabled={pending}
        onClick={() =>
          window.location.assign(`/login${window.location.search}`)
        }
      >
        {t("restart")}
      </Button>
    </>
  );
}
