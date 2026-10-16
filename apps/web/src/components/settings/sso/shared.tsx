"use client";

import { authClient } from "@shortn/auth/client";
import { Button } from "@shortn/ui";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useRef, useState } from "react";

export function ssoErrorCode(error: object): string | undefined {
  const code: unknown = Reflect.get(error, "code");
  return typeof code === "string" ? code : undefined;
}
export function ssoErrorKey(code?: string, status?: number) {
  if (["SESSION_IS_NOT_FRESH", "SESSION_EXPIRED"].includes(code ?? ""))
    return "fresh";
  if (code === "LAST_SIGN_IN_METHOD") return "lastMethod";
  if (code === "SSO_LINK_ACCOUNT_MISMATCH") return "accountMismatch";
  if (code === "SSO_LINK_EMAIL_MISMATCH") return "emailMismatch";
  if (["SSO_ACCOUNT_NOT_CONNECTED", "SSO_LINK_EXPIRED"].includes(code ?? ""))
    return "connectFirst";
  if (
    [
      "SSO_PROVIDER_UNAVAILABLE",
      "SSO_MEMBERSHIP_REQUIRED",
      "SSO_ENTERPRISE_OWNER_REQUIRED",
    ].includes(code ?? "")
  )
    return "unavailable";
  if (
    ["discovery_untrusted_origin", "discovery_private_host"].includes(
      code ?? "",
    )
  )
    return "origin";
  if (
    ["PROVIDERS_LIMIT_REACHED", "SSO_PROVIDER_LIMIT_REACHED"].includes(
      code ?? "",
    )
  )
    return "limit";
  if (
    [
      "SSO_NAME_INVALID",
      "SSO_CONFIGURATION_INVALID",
      "SSO_PROVIDER_ID_INVALID",
    ].includes(code ?? "")
  )
    return "configuration";
  if (status === 429) return "limited";
  return "failed";
}
export function SsoPagination({
  path,
  parameter,
  page,
  pages,
}: {
  path: string;
  parameter: string;
  page: number;
  pages: number;
}) {
  const t = useTranslations("settings.sso"),
    search = useSearchParams();
  if (pages <= 1) return null;
  const href = (value: number) => {
    const params = new URLSearchParams(search);
    params.set(parameter, String(value));
    return `${path}?${params}`;
  };
  return (
    <nav
      aria-label={t("pagination")}
      className="flex flex-wrap items-center gap-x-5 gap-y-3 text-small"
    >
      {page > 1 ? (
        <Link className="underline underline-offset-4" href={href(page - 1)}>
          {t("previous")}
        </Link>
      ) : null}
      <span className="text-fg-muted tabular-nums">
        {t("page", { page, pages })}
      </span>
      {page < pages ? (
        <Link className="underline underline-offset-4" href={href(page + 1)}>
          {t("next")}
        </Link>
      ) : null}
    </nav>
  );
}
export function SsoReauthenticate() {
  const t = useTranslations("settings.sso"),
    busy = useRef(false),
    [pending, setPending] = useState(false),
    [failed, setFailed] = useState(false);
  return (
    <div className="flex flex-col items-start gap-3">
      <Button
        type="button"
        variant="secondary"
        loading={pending}
        onClick={async () => {
          if (busy.current) return;
          busy.current = true;
          setPending(true);
          setFailed(false);
          try {
            const result = await authClient.signOut();
            if (!result.error) {
              window.location.assign(
                `/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`,
              );
              return;
            }
          } catch {
            /* Show a recoverable inline error. */
          }
          busy.current = false;
          setPending(false);
          setFailed(true);
        }}
      >
        {t("signInAgain")}
      </Button>
      {failed ? (
        <p role="alert" className="text-small text-danger">
          {t("errors.network")}
        </p>
      ) : null}
    </div>
  );
}
