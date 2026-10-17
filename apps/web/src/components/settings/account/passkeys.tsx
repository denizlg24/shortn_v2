"use client";

import { authClient } from "@shortn/auth/client";
import { Button, Input } from "@shortn/ui";
import { KeyRound } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import { AuthField } from "@/components/auth/auth-field";
import { Notice, SettingsSection } from "../section";

export function PasskeySettings({
  keys,
  total,
  page,
  pages,
  available,
  returnPath,
  passwordPath,
}: {
  keys: { id: string; name: string; createdAt: string }[];
  total: number;
  page: number;
  pages: number;
  available: boolean;
  returnPath: string;
  passwordPath: string;
}) {
  const t = useTranslations("settings.account.passkeys"),
    format = useFormatter(),
    router = useRouter();
  const [name, setName] = useState(""),
    [pending, setPending] = useState(false),
    [removing, setRemoving] = useState<string | null>(null);
  const [error, setError] = useState(""),
    [errorCode, setErrorCode] = useState(""),
    [notice, setNotice] = useState("");
  const busy = useRef(false),
    alert = useRef<HTMLParagraphElement>(null);
  function fail(value: {
    code?: string | undefined;
    status?: number | undefined;
  }) {
    const code = value.code ?? "";
    const key =
      code === "SESSION_IS_NOT_FRESH"
        ? "fresh"
        : code === "LAST_SIGN_IN_METHOD"
          ? "lastMethod"
          : code === "ADVANCED_AUTH_UNAVAILABLE"
            ? "unavailable"
            : code === "EMAIL_NOT_VERIFIED"
              ? "verifyEmail"
              : code === "ERROR_AUTHENTICATOR_PREVIOUSLY_REGISTERED"
                ? "duplicate"
                : [
                      "AUTH_CANCELLED",
                      "ERROR_CEREMONY_ABORTED",
                      "ERROR_PASSTHROUGH_SEE_CAUSE_PROPERTY",
                    ].includes(code)
                  ? "cancelled"
                  : value.status === 429
                    ? "limited"
                    : "failed";
    setErrorCode(code);
    setError(t(`errors.${key}`));
    requestAnimationFrame(() => alert.current?.focus());
  }
  async function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy.current) return;
    if (
      !name.trim() ||
      name.trim().length > 64 ||
      /[\p{Cc}\p{Cf}]/u.test(name)
    ) {
      setError(t("errors.name"));
      return;
    }
    if (!window.isSecureContext || !window.PublicKeyCredential) {
      setError(t("errors.unsupported"));
      return;
    }
    busy.current = true;
    setPending(true);
    setError("");
    setErrorCode("");
    setNotice("");
    try {
      const result = await authClient.passkey.addPasskey({
        name: name.normalize("NFC").trim(),
      });
      if (result.error) fail(result.error);
      else {
        setName("");
        setNotice(t("added"));
        router.refresh();
      }
    } catch {
      setError(t("errors.network"));
    }
    busy.current = false;
    setPending(false);
  }
  async function remove(id: string) {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    setError("");
    setErrorCode("");
    setNotice("");
    try {
      const result = await authClient.passkey.deletePasskey({ id });
      if (result.error) fail(result.error);
      else {
        window.location.assign(`/login?next=${encodeURIComponent(returnPath)}`);
        return;
      }
    } catch {
      setError(t("errors.network"));
    }
    busy.current = false;
    setPending(false);
  }
  return (
    <SettingsSection
      id="passkeys"
      title={t("title")}
      description={t("description")}
    >
      {notice ? (
        <Notice tone="success" live="status">
          {notice}
        </Notice>
      ) : null}
      <p className="text-small text-fg-muted">{t("count", { count: total })}</p>
      {keys.length ? (
        <ul className="border-t border-line text-small" aria-label={t("title")}>
          {keys.map((key) => (
            <li key={key.id} className="border-b border-line py-3">
              <div className="flex min-w-0 items-center gap-3">
                <KeyRound
                  aria-hidden
                  className="size-4 shrink-0 text-fg-muted"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium" title={key.name}>
                    {key.name || t("unnamed")}
                  </p>
                  <p className="text-meta text-fg-muted">
                    {t("created", {
                      date: format.dateTime(new Date(key.createdAt), {
                        dateStyle: "medium",
                      }),
                    })}
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={pending}
                  aria-label={t("removeLabel", {
                    name: key.name || t("unnamed"),
                  })}
                  onClick={() => {
                    setRemoving(key.id);
                    setError("");
                    setErrorCode("");
                  }}
                >
                  {t("remove")}
                </Button>
              </div>
              {removing === key.id ? (
                <div className="mt-3 flex flex-col gap-3">
                  <p className="text-small text-fg-muted">
                    {t("removeEffect")}
                  </p>
                  <div className="flex flex-wrap gap-3">
                    <Button
                      type="button"
                      variant="primary"
                      loading={pending}
                      onClick={() => void remove(key.id)}
                    >
                      {t("confirmRemove")}
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={pending}
                      onClick={() => setRemoving(null)}
                    >
                      {t("cancel")}
                    </Button>
                  </div>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-small text-fg-muted">{t("empty")}</p>
      )}
      {pages > 1 ? (
        <nav
          aria-label={t("pagination")}
          className="flex flex-wrap items-center gap-x-5 gap-y-3 text-small"
        >
          {page > 1 ? (
            <Link
              className="underline underline-offset-4"
              href={`${returnPath}?passkeyPage=${page - 1}#passkeys`}
            >
              {t("previous")}
            </Link>
          ) : null}
          <span className="text-fg-muted tabular-nums">
            {t("page", { page, pages })}
          </span>
          {page < pages ? (
            <Link
              className="underline underline-offset-4"
              href={`${returnPath}?passkeyPage=${page + 1}#passkeys`}
            >
              {t("next")}
            </Link>
          ) : null}
        </nav>
      ) : null}
      {available ? (
        <form onSubmit={add} noValidate className="flex flex-col gap-4">
          <AuthField id="passkey-name" label={t("name")} hint={t("nameHelp")}>
            {(control) => (
              <Input
                {...control}
                name="passkeyName"
                value={name}
                maxLength={64}
                disabled={pending}
                autoComplete="off"
                onChange={(event) => {
                  setName(event.target.value);
                  setError("");
                  setErrorCode("");
                }}
              />
            )}
          </AuthField>
          <div>
            <Button
              type="submit"
              variant="secondary"
              loading={pending}
              disabled={pending}
            >
              {t("add")}
            </Button>
          </div>
        </form>
      ) : (
        <p className="text-small text-fg-muted">{t("unavailable")}</p>
      )}
      {error ? (
        <p
          ref={alert}
          role="alert"
          tabIndex={-1}
          className="text-small text-danger"
        >
          {error}
        </p>
      ) : null}
      {errorCode === "LAST_SIGN_IN_METHOD" ? (
        <Link
          className="text-small underline underline-offset-4"
          href={passwordPath}
        >
          {t("password")}
        </Link>
      ) : null}
      {errorCode === "SESSION_IS_NOT_FRESH" ? (
        <div>
          <Button
            type="button"
            variant="secondary"
            disabled={pending}
            onClick={async () => {
              if (busy.current) return;
              busy.current = true;
              setPending(true);
              try {
                const result = await authClient.signOut();
                if (result.error) fail(result.error);
                else {
                  window.location.assign(
                    `/login?next=${encodeURIComponent(returnPath)}`,
                  );
                  return;
                }
              } catch {
                setError(t("errors.network"));
              }
              busy.current = false;
              setPending(false);
            }}
          >
            {t("signInAgain")}
          </Button>
        </div>
      ) : null}
    </SettingsSection>
  );
}
