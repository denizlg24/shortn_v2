"use client";

import { authClient } from "@shortn/auth/client";
import { qrMatrix } from "@shortn/qr-render/matrix";
import { Button, Input } from "@shortn/ui";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState, type FormEvent } from "react";
import { AuthField } from "@/components/auth/auth-field";
import { PasswordInput } from "@/components/auth/password-input";
import { Notice, SettingsSection } from "../section";

function SetupQr({ uri, label }: { uri: string; label: string }) {
  const matrix = useMemo(() => qrMatrix(uri, "M"), [uri]),
    size = matrix.size + 8;
  const path: string[] = [];
  for (let row = 0; row < matrix.size; row++)
    for (let col = 0; col < matrix.size; col++)
      if (matrix.dark(row, col)) path.push(`M${col + 4} ${row + 4}h1v1h-1z`);
  return (
    <svg
      role="img"
      aria-label={label}
      viewBox={`0 0 ${size} ${size}`}
      width="180"
      height="180"
      className="max-w-full shrink-0"
      shapeRendering="crispEdges"
    >
      <rect width={size} height={size} fill="#fff" />
      <path d={path.join("")} fill="#000" />
    </svg>
  );
}

export function TwoFactorSettings({
  active,
  available,
  hasPassword,
}: {
  active: boolean;
  available: boolean;
  hasPassword: boolean;
}) {
  const t = useTranslations("settings.account.twoFactor"),
    router = useRouter();
  const [enabled, setEnabled] = useState(active),
    [mode, setMode] = useState<
      "idle" | "setup" | "codes" | "rotate" | "disable"
    >("idle");
  const [setup, setSetup] = useState<{ uri: string; codes: string[] } | null>(
      null,
    ),
    [codes, setCodes] = useState<string[]>([]);
  const [password, setPassword] = useState(""),
    [code, setCode] = useState(""),
    [saved, setSaved] = useState(false),
    [confirmed, setConfirmed] = useState(false);
  const [pending, setPending] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [copied, setCopied] = useState(false);
  const busy = useRef(false),
    alert = useRef<HTMLParagraphElement>(null);
  function reset() {
    setMode("idle");
    setSetup(null);
    setCodes([]);
    setPassword("");
    setCode("");
    setSaved(false);
    setConfirmed(false);
    setError("");
    setCopied(false);
  }
  function fail(value: {
    code?: string | undefined;
    status?: number | undefined;
  }) {
    const key =
      value.code === "SESSION_IS_NOT_FRESH"
        ? "fresh"
        : value.code === "INVALID_PASSWORD"
          ? "passwordWrong"
          : value.code === "TOTP_ALREADY_USED"
            ? "used"
            : value.code === "ADVANCED_AUTH_UNAVAILABLE"
              ? "unavailable"
              : value.status === 429
                ? "limited"
                : "failed";
    setError(t(`errors.${key}`));
    requestAnimationFrame(() => alert.current?.focus());
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy.current) return;
    if (
      mode === "setup"
        ? !/^\d{6}$/.test(code.trim()) || !saved
        : !password || (mode === "disable" && !confirmed)
    ) {
      setError(t("errors.required"));
      requestAnimationFrame(() => alert.current?.focus());
      return;
    }
    busy.current = true;
    setPending(true);
    setError("");
    setNotice("");
    try {
      if (mode === "setup") {
        const result = await authClient.twoFactor.verifyTotp({
          code: code.trim(),
        });
        if (result.error) fail(result.error);
        else {
          setEnabled(true);
          setCodes(setup!.codes);
          setSetup(null);
          setMode("codes");
          setCode("");
          setNotice(t("enabled"));
          router.refresh();
        }
      } else if (mode === "disable") {
        const result = await authClient.twoFactor.disable({ password });
        if (result.error) fail(result.error);
        else {
          reset();
          setEnabled(false);
          setNotice(t("disabled"));
          router.refresh();
        }
      } else if (mode === "rotate") {
        const result = await authClient.twoFactor.generateBackupCodes({
          password,
        });
        if (result.error) fail(result.error);
        else {
          setCodes(result.data.backupCodes);
          setPassword("");
          setMode("codes");
          setSaved(false);
          setNotice(t("replaced"));
        }
      } else {
        const result = await authClient.twoFactor.enable({ password });
        if (result.error) fail(result.error);
        else if (result.data.method === "totp") {
          setSetup({
            uri: result.data.totpURI!,
            codes: result.data.backupCodes!,
          });
          setMode("setup");
          setPassword("");
          setSaved(false);
        }
      }
    } catch {
      setError(t("errors.network"));
    }
    busy.current = false;
    setPending(false);
  }
  async function copyCodes(values: string[]) {
    try {
      await navigator.clipboard.writeText(values.join("\n"));
      setCopied(true);
    } catch {
      setError(t("errors.clipboard"));
    }
  }
  const visibleCodes = setup?.codes ?? codes;
  const canStart = available && hasPassword;
  return (
    <SettingsSection
      id="two-factor"
      anchor="security-two-factor"
      title={t("title")}
      description={t("description")}
    >
      <p className="text-small font-medium" role="status">
        {t(enabled ? "on" : "off")}
      </p>
      {notice ? (
        <Notice tone="success" live="status">
          {notice}
        </Notice>
      ) : null}
      {!enabled && !canStart && mode === "idle" ? (
        <p className="text-small text-fg-muted">
          {t(!hasPassword ? "needPassword" : "unavailable")}
        </p>
      ) : null}
      {mode === "setup" && setup ? (
        <>
          <p className="text-small">{t("scan")}</p>
          <SetupQr uri={setup.uri} label={t("qrLabel")} />
          <details className="min-w-0 text-small">
            <summary className="cursor-pointer text-fg-muted underline underline-offset-4">
              {t("manual")}
            </summary>
            <p className="mt-2 break-all font-mono text-meta select-all">
              {new URL(setup.uri).searchParams.get("secret")}
            </p>
          </details>
        </>
      ) : null}
      {visibleCodes.length ? (
        <div className="flex min-w-0 flex-col gap-3">
          <h3 className="text-small font-medium">{t("codesTitle")}</h3>
          <p className="text-small text-fg-muted">{t("codesHelp")}</p>
          <ul
            aria-label={t("codesTitle")}
            className="grid grid-cols-2 gap-x-5 gap-y-2 font-mono text-small tabular-nums select-all"
          >
            {visibleCodes.map((value) => (
              <li key={value}>{value}</li>
            ))}
          </ul>
          <div>
            <Button
              type="button"
              variant="secondary"
              onClick={() => void copyCodes(visibleCodes)}
            >
              {t(copied ? "copied" : "copy")}
            </Button>
          </div>
          <label className="flex items-start gap-2 text-small">
            <input
              type="checkbox"
              checked={saved}
              disabled={pending}
              onChange={(event) => setSaved(event.target.checked)}
              className="mt-0.5 size-4 shrink-0 accent-signal"
            />
            {t("saved")}
          </label>
        </div>
      ) : null}
      {mode === "codes" ? (
        <div>
          <Button
            type="button"
            variant="primary"
            disabled={!saved}
            onClick={reset}
          >
            {t("finish")}
          </Button>
        </div>
      ) : mode !== "idle" || (!enabled && canStart) ? (
        <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
          {mode === "setup" ? (
            <AuthField id="setup-totp-code" label={t("codeLabel")}>
              {(control) => (
                <Input
                  {...control}
                  id="setup-totp-code"
                  name="totpCode"
                  value={code}
                  onChange={(event) => {
                    setCode(event.target.value);
                    setError("");
                  }}
                  disabled={pending}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                />
              )}
            </AuthField>
          ) : (
            <AuthField id="totp-password" label={t("passwordLabel")}>
              {(control) => (
                <PasswordInput
                  {...control}
                  id="totp-password"
                  name="totpPassword"
                  value={password}
                  onChange={(event) => {
                    setPassword(event.target.value);
                    setError("");
                  }}
                  disabled={pending}
                  autoComplete="current-password"
                />
              )}
            </AuthField>
          )}
          {mode === "disable" ? (
            <label className="flex items-start gap-2 text-small">
              <input
                type="checkbox"
                checked={confirmed}
                disabled={pending}
                onChange={(event) => setConfirmed(event.target.checked)}
                className="mt-0.5 size-4 shrink-0 accent-signal"
              />
              {t("disableEffect")}
            </label>
          ) : null}
          <div className="flex flex-wrap gap-3">
            <Button
              type="submit"
              variant="primary"
              loading={pending}
              disabled={
                pending ||
                (mode === "setup" && !saved) ||
                (mode === "disable" && !confirmed)
              }
            >
              {t(
                mode === "setup"
                  ? "verify"
                  : mode === "disable"
                    ? "disable"
                    : mode === "rotate"
                      ? "rotate"
                      : "start",
              )}
            </Button>
            {mode !== "idle" ? (
              <Button
                type="button"
                variant="secondary"
                disabled={pending}
                onClick={reset}
              >
                {t("cancel")}
              </Button>
            ) : null}
          </div>
        </form>
      ) : enabled ? (
        <div className="flex flex-wrap gap-3">
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              reset();
              setMode("rotate");
            }}
          >
            {t("rotate")}
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              reset();
              setMode("disable");
            }}
          >
            {t("disable")}
          </Button>
        </div>
      ) : null}
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
      {error === t("errors.fresh") ? (
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
                    `/login?next=${encodeURIComponent(window.location.pathname)}`,
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
