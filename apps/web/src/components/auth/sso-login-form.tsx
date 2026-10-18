"use client";

import { authClient } from "@shortn/auth/client";
import type { SsoProviderView } from "@shortn/auth/sso-views";
import { Button, Input } from "@shortn/ui";
import { Building2 } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRef, useState, type FormEvent } from "react";
import { ssoErrorCode, ssoErrorKey } from "@/components/settings/sso/shared";
import { AuthField } from "./auth-field";
import { AuthHeading, FormAlert } from "./auth-parts";

export function SsoLoginForm({
  next,
  backHref,
  errorCode,
}: {
  next: string;
  backHref: string;
  errorCode: string | null;
}) {
  const t = useTranslations("auth.sso"),
    errors = useTranslations("settings.sso.errors"),
    busy = useRef(false);
  const [workspace, setWorkspace] = useState(""),
    [pending, setPending] = useState(false),
    [error, setError] = useState(
      errorCode ? errors(ssoErrorKey(errorCode)) : "",
    );
  const [result, setResult] = useState<{
    rows: SsoProviderView[];
    page: number;
    pages: number;
    workspaceName: string | null;
  } | null>(null);
  async function lookup(event?: FormEvent<HTMLFormElement>, page = 1) {
    event?.preventDefault();
    if (busy.current) return;
    if (!workspace.trim()) {
      setError(t("required"));
      return;
    }
    busy.current = true;
    setPending(true);
    setError("");
    try {
      const response = await authClient.$fetch<{
        rows: SsoProviderView[];
        page: number;
        pages: number;
        workspaceName: string | null;
      }>("/shortn/sso/discover", {
        method: "GET",
        query: { workspace: workspace.trim(), page },
      });
      if (response.error)
        setError(
          errors(
            ssoErrorKey(ssoErrorCode(response.error), response.error.status),
          ),
        );
      else {
        setResult(response.data);
        if (!response.data?.rows.length) setError(t("notFound"));
      }
    } catch {
      setError(errors("network"));
    }
    busy.current = false;
    setPending(false);
  }
  return (
    <>
      <AuthHeading title={t("title")} description={t("description")} />
      <form onSubmit={lookup} noValidate className="flex flex-col gap-4">
        <AuthField
          id="sso-workspace"
          label={t("workspace")}
          hint={t("workspaceHelp")}
        >
          {(control) => (
            <Input
              {...control}
              name="ssoWorkspace"
              size="lg"
              maxLength={64}
              value={workspace}
              disabled={pending}
              autoFocus
              autoCapitalize="none"
              autoComplete="off"
              spellCheck={false}
              leading={<Building2 aria-hidden />}
              onChange={(e) => {
                setWorkspace(e.target.value);
                setResult(null);
                setError("");
              }}
            />
          )}
        </AuthField>
        <Button
          type="submit"
          size="lg"
          variant="primary"
          loading={pending}
          className="w-full"
        >
          {t("find")}
        </Button>
      </form>
      {result?.rows.length ? (
        <div className="mt-6 flex flex-col gap-3">
          <p className="text-small text-fg-muted">
            {t("choose", { workspace: result.workspaceName ?? workspace })}
          </p>
          <ul className="flex flex-col gap-3">
            {result.rows.map((provider) => (
              <li key={provider.id}>
                <Button
                  type="button"
                  size="lg"
                  variant="secondary"
                  disabled={pending}
                  className="w-full min-w-0"
                  onClick={async () => {
                    if (busy.current) return;
                    busy.current = true;
                    setPending(true);
                    setError("");
                    try {
                      const response = await authClient.signIn.sso({
                        providerId: provider.providerId,
                        providerType: provider.protocol,
                        callbackURL: next,
                        errorCallbackURL: `/login/sso${window.location.search}`,
                      });
                      if (response.error)
                        setError(
                          errors(
                            ssoErrorKey(
                              ssoErrorCode(response.error),
                              response.error.status,
                            ),
                          ),
                        );
                    } catch {
                      setError(errors("network"));
                    }
                    busy.current = false;
                    setPending(false);
                  }}
                >
                  <span className="min-w-0 truncate">{provider.name}</span>
                  <span className="shrink-0 text-meta text-fg-muted">
                    {provider.protocol === "oidc" ? "OIDC" : "SAML"}
                  </span>
                </Button>
              </li>
            ))}
          </ul>
          {result.pages > 1 ? (
            <div className="flex flex-wrap items-center justify-between gap-3 text-small">
              {result.page > 1 ? (
                <Button
                  type="button"
                  variant="ghost"
                  disabled={pending}
                  onClick={() => void lookup(undefined, result.page - 1)}
                >
                  {t("previous")}
                </Button>
              ) : null}
              <span className="text-fg-muted tabular-nums">
                {t("page", { page: result.page, pages: result.pages })}
              </span>
              {result.page < result.pages ? (
                <Button
                  type="button"
                  variant="ghost"
                  disabled={pending}
                  onClick={() => void lookup(undefined, result.page + 1)}
                >
                  {t("next")}
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
      {error ? (
        <div className="mt-4">
          <FormAlert>{error}</FormAlert>
        </div>
      ) : null}
      <p className="mt-6 text-small text-pretty text-fg-muted">
        {t("connectHelp")}
      </p>
      <Link
        href={backHref}
        className="mt-4 text-center text-small text-fg-muted underline underline-offset-4 hover:text-fg"
      >
        {t("back")}
      </Link>
    </>
  );
}
