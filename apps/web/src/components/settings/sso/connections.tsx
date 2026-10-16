"use client";

import { authClient } from "@shortn/auth/client";
import type {
  SsoConnectionView,
  SsoProviderView,
} from "@shortn/auth/sso-views";
import { Button } from "@shortn/ui";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRef, useState } from "react";
import { SettingsSection } from "../section";
import { SsoPagination, SsoReauthenticate, ssoErrorKey } from "./shared";

export function SsoConnections({
  connections,
  available,
  workspaceName,
  returnPath,
  settingsPath,
  email,
  errorCode,
}: {
  connections: {
    rows: SsoConnectionView[];
    total: number;
    page: number;
    pages: number;
  };
  available: {
    rows: (SsoProviderView & { connected: boolean })[];
    total: number;
    page: number;
    pages: number;
  };
  workspaceName: string;
  returnPath: string;
  settingsPath: string;
  email: string;
  errorCode: string | null;
}) {
  const t = useTranslations("settings.sso"),
    busy = useRef(false),
    alert = useRef<HTMLParagraphElement>(null);
  const [pending, setPending] = useState(false),
    [connect, setConnect] = useState<string | null>(null),
    [disconnect, setDisconnect] = useState<string | null>(null);
  const [error, setError] = useState(
      errorCode ? t(`errors.${ssoErrorKey(errorCode)}`) : "",
    ),
    [fresh, setFresh] = useState(false),
    [lastMethod, setLastMethod] = useState(false);
  function fail(value: {
    code?: string | undefined;
    status?: number | undefined;
  }) {
    const key = ssoErrorKey(value.code, value.status);
    setError(t(`errors.${key}`));
    setFresh(key === "fresh");
    setLastMethod(key === "lastMethod");
    requestAnimationFrame(() => alert.current?.focus());
  }
  async function run(action: () => Promise<void>) {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    setError("");
    setFresh(false);
    setLastMethod(false);
    try {
      await action();
    } catch {
      setError(t("errors.network"));
    }
    busy.current = false;
    setPending(false);
  }
  return (
    <SettingsSection
      id="sso-connections"
      title={t("connections.title")}
      description={t("connections.description")}
    >
      <p className="text-small text-fg-muted">
        {t("connections.count", { count: connections.total })}
      </p>
      {connections.rows.length ? (
        <ul
          className="border-t border-line text-small"
          aria-label={t("connections.title")}
        >
          {connections.rows.map((row) => (
            <li key={row.id} className="border-b border-line py-3">
              <div className="flex min-w-0 items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium" title={row.name}>
                    {row.name}
                  </p>
                  <p
                    className="truncate text-meta text-fg-muted"
                    title={row.workspaceName}
                  >
                    {row.workspaceName || t("connections.formerWorkspace")} ·{" "}
                    {t(
                      row.available
                        ? "connections.connected"
                        : "connections.unavailable",
                    )}
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={pending}
                  aria-label={t("connections.disconnectLabel", {
                    name: row.name,
                  })}
                  onClick={() => {
                    setDisconnect(row.providerId);
                    setConnect(null);
                  }}
                >
                  {t("connections.disconnect")}
                </Button>
              </div>
              {disconnect === row.providerId ? (
                <div className="mt-3 flex flex-col gap-3">
                  <p className="text-small text-fg-muted">
                    {t("connections.disconnectEffect")}
                  </p>
                  <div className="flex flex-wrap gap-3">
                    <Button
                      type="button"
                      variant="primary"
                      loading={pending}
                      onClick={() =>
                        void run(async () => {
                          const result = await authClient.$fetch(
                            "/shortn/sso/disconnect",
                            {
                              method: "POST",
                              body: { providerId: row.providerId },
                            },
                          );
                          if (result.error) fail(result.error);
                          else
                            window.location.assign(
                              `/login?next=${encodeURIComponent(returnPath)}`,
                            );
                        })
                      }
                    >
                      {t("connections.confirmDisconnect")}
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={pending}
                      onClick={() => setDisconnect(null)}
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
        <p className="text-small text-fg-muted">{t("connections.empty")}</p>
      )}
      <SsoPagination
        path={returnPath}
        parameter="ssoConnectedPage"
        page={connections.page}
        pages={connections.pages}
      />
      <div className="flex flex-col gap-3">
        <h4 className="text-small font-medium">
          {t("connections.available", { workspace: workspaceName })}
        </h4>
        {available.rows.length ? (
          <ul
            className="border-t border-line text-small"
            aria-label={t("connections.available", {
              workspace: workspaceName,
            })}
          >
            {available.rows.map((row) => (
              <li key={row.id} className="border-b border-line py-3">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium" title={row.name}>
                      {row.name}
                    </p>
                    <p className="truncate text-meta text-fg-muted">
                      {row.protocol === "oidc" ? "OIDC" : "SAML"} · {row.domain}
                    </p>
                  </div>
                  {row.connected ? (
                    <span className="text-meta text-fg-muted">
                      {t("connections.connected")}
                    </span>
                  ) : (
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      disabled={pending}
                      aria-label={t("connections.connectLabel", {
                        name: row.name,
                      })}
                      onClick={() => {
                        setConnect(row.providerId);
                        setDisconnect(null);
                      }}
                    >
                      {t("connections.connect")}
                    </Button>
                  )}
                </div>
                {connect === row.providerId ? (
                  <div className="mt-3 flex flex-col gap-3">
                    <p className="text-small text-fg-muted">
                      {t("connections.consent", {
                        email,
                        provider: row.name,
                        workspace: workspaceName,
                      })}
                    </p>
                    <div className="flex flex-wrap gap-3">
                      <Button
                        type="button"
                        variant="primary"
                        loading={pending}
                        onClick={() =>
                          void run(async () => {
                            const prepared = await authClient.$fetch(
                              "/shortn/sso/link-intent",
                              {
                                method: "POST",
                                body: { providerId: row.providerId },
                              },
                            );
                            if (prepared.error) {
                              fail(prepared.error);
                              return;
                            }
                            const result = await authClient.signIn.sso({
                              providerId: row.providerId,
                              providerType: row.protocol,
                              callbackURL: returnPath,
                              errorCallbackURL: `${returnPath}?ssoError=1`,
                            });
                            if (result.error) fail(result.error);
                          })
                        }
                      >
                        {t("connections.confirmConnect")}
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        disabled={pending}
                        onClick={() => setConnect(null)}
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
          <p className="text-small text-fg-muted">
            {t("connections.noneAvailable")}
          </p>
        )}
        <SsoPagination
          path={returnPath}
          parameter="ssoAvailablePage"
          page={available.page}
          pages={available.pages}
        />
        <Link
          className="text-small underline underline-offset-4"
          href={settingsPath}
        >
          {t("connections.settings")}
        </Link>
      </div>
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
      {fresh ? <SsoReauthenticate /> : null}
      {lastMethod ? (
        <Link
          href={returnPath.replace(/\/sign-in$/, "/password")}
          className="text-small underline underline-offset-4"
        >
          {t("connections.password")}
        </Link>
      ) : null}
    </SettingsSection>
  );
}
