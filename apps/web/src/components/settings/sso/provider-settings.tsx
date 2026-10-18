"use client";

import { authClient } from "@shortn/auth/client";
import type { SsoProviderView } from "@shortn/auth/sso-views";
import { Button, Input, Textarea } from "@shortn/ui";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import { AuthField } from "@/components/auth/auth-field";
import { PlanGate } from "@/components/plan-gate";
import { PasswordInput } from "@/components/auth/password-input";
import { Notice, SettingsSection } from "../section";
import {
  SsoPagination,
  SsoReauthenticate,
  ssoErrorCode,
  ssoErrorKey,
} from "./shared";

export function SsoProviderSettings({
  rows,
  total,
  page,
  pages,
  workspaceId,
  owner,
  eligible,
  reason,
  returnPath,
  origin,
}: {
  rows: SsoProviderView[];
  total: number;
  page: number;
  pages: number;
  workspaceId: string;
  owner: boolean;
  eligible: boolean;
  reason: "personal" | "enterprise" | "flag" | "owner" | null;
  returnPath: string;
  origin: string;
}) {
  const t = useTranslations("settings.sso"),
    router = useRouter(),
    busy = useRef(false),
    alert = useRef<HTMLParagraphElement>(null);
  const [adding, setAdding] = useState(false),
    [providerId, setProviderId] = useState(""),
    [protocol, setProtocol] = useState<"oidc" | "saml">("oidc");
  const [name, setName] = useState(""),
    [domain, setDomain] = useState(""),
    [issuer, setIssuer] = useState(""),
    [clientId, setClientId] = useState(""),
    [secret, setSecret] = useState(""),
    [metadata, setMetadata] = useState("");
  const [emailClaim, setEmailClaim] = useState("email"),
    [nameClaim, setNameClaim] = useState("name");
  const [pending, setPending] = useState(false),
    [error, setError] = useState(""),
    [fresh, setFresh] = useState(false),
    [notice, setNotice] = useState("");
  const [dns, setDns] = useState<{
      providerId: string;
      domain: string;
      token: string;
    } | null>(null),
    [removing, setRemoving] = useState<string | null>(null),
    [copied, setCopied] = useState(false);
  const callback = `${origin}/api/auth/sso/callback/${providerId}`,
    entityId = `${origin}/api/auth/sso/saml/${providerId}`,
    acs = `${origin}/api/auth/sso/saml2/sp/acs/${providerId}`;
  function fail(value: {
    code?: string | undefined;
    status?: number | undefined;
  }) {
    const key = ssoErrorKey(value.code, value.status);
    setError(t(`errors.${key}`));
    setFresh(key === "fresh");
    requestAnimationFrame(() => alert.current?.focus());
  }
  async function run(action: () => Promise<void>) {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    setError("");
    setFresh(false);
    setNotice("");
    try {
      await action();
    } catch {
      setError(t("errors.network"));
    }
    busy.current = false;
    setPending(false);
  }
  function reset() {
    setAdding(false);
    setName("");
    setDomain("");
    setIssuer("");
    setClientId("");
    setSecret("");
    setMetadata("");
    setEmailClaim("email");
    setNameClaim("name");
  }
  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (
      !name.trim() ||
      !domain.trim() ||
      name.length > 64 ||
      (protocol === "oidc"
        ? !issuer.trim() || !clientId.trim() || !secret
        : !metadata.trim())
    ) {
      setError(t("errors.required"));
      return;
    }
    await run(async () => {
      const body = {
        providerId,
        workspaceId,
        displayName: name.normalize("NFC").trim(),
        domain: domain.trim().toLowerCase(),
        identityIssuer: protocol === "oidc" ? issuer.trim() : entityId,
        issuer: protocol === "oidc" ? issuer.trim() : entityId,
        ...(protocol === "oidc"
          ? {
              oidcConfig: {
                clientId: clientId.trim(),
                clientSecret: secret,
                mapping: {
                  email: emailClaim.trim() || "email",
                  name: nameClaim.trim() || "name",
                  emailVerified: "email_verified",
                },
              },
            }
          : {
              samlConfig: {
                issuer: entityId,
                entryPoint: origin,
                audience: entityId,
                idpMetadata: { metadata },
                mapping: {
                  email: emailClaim.trim() || "email",
                  name: nameClaim.trim() || "displayName",
                },
              },
            }),
      };
      const result = await authClient.$fetch<{
        domainVerificationToken: string;
      }>("/sso/register", { method: "POST", body });
      if (result.error) fail(result.error);
      else {
        setDns({
          providerId,
          domain: domain.trim().toLowerCase(),
          token: result.data!.domainVerificationToken,
        });
        setCopied(false);
        reset();
        setNotice(t("created"));
        router.refresh();
      }
    });
  }
  async function dnsRecord(row: SsoProviderView) {
    await run(async () => {
      const result = await authClient.$fetch<{
        domainVerificationToken: string;
      }>("/sso/request-domain-verification", {
        method: "POST",
        body: { providerId: row.providerId },
      });
      if (result.error) fail(result.error);
      else {
        setDns({
          providerId: row.providerId,
          domain: row.domain,
          token: result.data!.domainVerificationToken,
        });
        setCopied(false);
      }
    });
  }
  return (
    <div className="flex flex-col gap-10">
      <SettingsSection
        id="sso-providers"
        title={t("providers")}
        description={t("description")}
      >
        {notice ? (
          <Notice tone="success" live="status">
            {notice}
          </Notice>
        ) : null}
        <p className="text-small text-fg-muted">
          {t("count", { count: total })}
        </p>
        {reason === "enterprise" ? (
          <div className="flex flex-col items-start gap-3">
            {owner ? (
              <Button
                type="button"
                variant="secondary"
                disabled
                aria-describedby="sso-gate"
              >
                {t("add")}
              </Button>
            ) : null}
            <PlanGate id="sso-gate" feature="sso" plan="enterprise" />
          </div>
        ) : reason ? (
          <p className="text-small text-fg-muted">
            {t(`availability.${reason}`)}
          </p>
        ) : null}
        {rows.length ? (
          <ul
            className="border-t border-line text-small"
            aria-label={t("providers")}
          >
            {rows.map((row) => (
              <li key={row.id} className="border-b border-line py-3">
                <div className="flex min-w-0 flex-wrap items-center gap-3">
                  <div className="min-w-0 flex-1 basis-48">
                    <p className="truncate font-medium" title={row.name}>
                      {row.name}
                    </p>
                    <p
                      className="truncate text-meta text-fg-muted"
                      title={row.domain}
                    >
                      {row.protocol === "oidc" ? "OIDC" : "SAML"} · {row.domain}
                    </p>
                    <p className="mt-1 text-meta text-fg-muted">
                      {t(row.verified ? "verified" : "unverified")}
                    </p>
                  </div>
                  {owner ? (
                    <div className="flex flex-wrap gap-2">
                      {!row.verified && eligible ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          disabled={pending}
                          onClick={() => void dnsRecord(row)}
                        >
                          {t("dns.show")}
                        </Button>
                      ) : null}
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        disabled={pending}
                        aria-label={t("removeLabel", { name: row.name })}
                        onClick={() => setRemoving(row.providerId)}
                      >
                        {t("remove")}
                      </Button>
                    </div>
                  ) : null}
                </div>
                {row.protocol === "saml" ? (
                  <a
                    href={`${origin}/api/auth/sso/saml2/sp/metadata?providerId=${encodeURIComponent(row.providerId)}&format=xml`}
                    className="mt-2 inline-block text-meta underline underline-offset-4"
                    target="_blank"
                    rel="noreferrer"
                  >
                    {t("metadataDownload")}
                  </a>
                ) : null}
                {removing === row.providerId ? (
                  <div className="mt-3 flex flex-col gap-3">
                    <p className="text-small text-fg-muted">
                      {t("removeEffect")}
                    </p>
                    <div className="flex flex-wrap gap-3">
                      <Button
                        type="button"
                        variant="danger"
                        loading={pending}
                        onClick={() =>
                          void run(async () => {
                            const result = await authClient.$fetch(
                              "/sso/delete-provider",
                              {
                                method: "POST",
                                body: { providerId: row.providerId },
                              },
                            );
                            if (result.error) fail(result.error);
                            else {
                              setRemoving(null);
                              if (dns?.providerId === row.providerId)
                                setDns(null);
                              setNotice(t("removed"));
                              router.refresh();
                            }
                          })
                        }
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
        <SsoPagination
          path={returnPath}
          parameter="page"
          page={page}
          pages={pages}
        />
        {owner && eligible && !adding ? (
          <div>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setProviderId(`sso-${crypto.randomUUID().slice(0, 12)}`);
                setAdding(true);
                setError("");
                setFresh(false);
              }}
            >
              {t("add")}
            </Button>
          </div>
        ) : null}
      </SettingsSection>
      {dns ? (
        <SettingsSection
          id="sso-dns"
          title={t("dns.title")}
          description={t("dns.help")}
        >
          <dl className="flex min-w-0 flex-col gap-3 text-small">
            <div>
              <dt className="text-fg-muted">{t("dns.host")}</dt>
              <dd className="mt-1 break-all font-mono select-all">{`_shortn-sso-${dns.providerId}.${dns.domain}`}</dd>
            </div>
            <div>
              <dt className="text-fg-muted">{t("dns.value")}</dt>
              <dd className="mt-1 break-all font-mono select-all">
                {dns.token}
              </dd>
            </div>
          </dl>
          <p className="text-small text-fg-muted">{t("dns.type")}</p>
          <div className="flex flex-wrap gap-3">
            <Button
              type="button"
              variant="primary"
              loading={pending}
              onClick={() =>
                void run(async () => {
                  const result = await authClient.$fetch("/sso/verify-domain", {
                    method: "POST",
                    body: { providerId: dns.providerId },
                  });
                  if (result.error) {
                    if (ssoErrorCode(result.error) === "SESSION_IS_NOT_FRESH")
                      fail({ code: "SESSION_IS_NOT_FRESH" });
                    else setError(t("errors.dns"));
                  } else {
                    setDns(null);
                    setNotice(t("dns.verified"));
                    router.refresh();
                  }
                })
              }
            >
              {t("dns.verify")}
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={pending}
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(
                    `_shortn-sso-${dns.providerId}.${dns.domain}\tTXT\t${dns.token}`,
                  );
                  setCopied(true);
                } catch {
                  setError(t("errors.clipboard"));
                }
              }}
            >
              {t(copied ? "copied" : "dns.copy")}
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={pending}
              onClick={() => setDns(null)}
            >
              {t("close")}
            </Button>
          </div>
        </SettingsSection>
      ) : null}
      {adding ? (
        <SettingsSection
          id="sso-create"
          title={t("add")}
          description={t("createHelp")}
        >
          <form onSubmit={create} noValidate className="flex flex-col gap-4">
            <AuthField
              id="sso-name"
              label={t("fields.name")}
              hint={t("fields.nameHelp")}
            >
              {(control) => (
                <Input
                  {...control}
                  name="ssoName"
                  maxLength={64}
                  value={name}
                  disabled={pending}
                  onChange={(e) => setName(e.target.value)}
                  autoFocus
                />
              )}
            </AuthField>
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-2 text-small font-medium">
                {t("fields.protocol")}
              </legend>
              <div className="flex flex-wrap gap-5">
                {(["oidc", "saml"] as const).map((value) => (
                  <label
                    key={value}
                    className="flex items-center gap-2 text-small"
                  >
                    <input
                      type="radio"
                      name="ssoProtocol"
                      value={value}
                      checked={protocol === value}
                      disabled={pending}
                      onChange={() => {
                        setProtocol(value);
                        setNameClaim(value === "oidc" ? "name" : "displayName");
                      }}
                      className="size-4 accent-signal"
                    />
                    {value === "oidc" ? "OpenID Connect (OIDC)" : "SAML 2.0"}
                  </label>
                ))}
              </div>
            </fieldset>
            <AuthField
              id="sso-domain"
              label={t("fields.domain")}
              hint={t("fields.domainHelp")}
            >
              {(control) => (
                <Input
                  {...control}
                  name="ssoDomain"
                  maxLength={253}
                  value={domain}
                  disabled={pending}
                  onChange={(e) => setDomain(e.target.value)}
                  autoCapitalize="none"
                  autoComplete="off"
                  spellCheck={false}
                />
              )}
            </AuthField>
            {protocol === "oidc" ? (
              <>
                <AuthField
                  id="sso-issuer"
                  label={t("fields.issuer")}
                  hint={t("fields.issuerHelp")}
                >
                  {(control) => (
                    <Input
                      {...control}
                      name="ssoIssuer"
                      type="url"
                      value={issuer}
                      maxLength={2048}
                      disabled={pending}
                      onChange={(e) => setIssuer(e.target.value)}
                      autoCapitalize="none"
                      autoComplete="off"
                      spellCheck={false}
                    />
                  )}
                </AuthField>
                <AuthField id="sso-client-id" label={t("fields.clientId")}>
                  {(control) => (
                    <Input
                      {...control}
                      name="ssoClientId"
                      value={clientId}
                      maxLength={256}
                      disabled={pending}
                      onChange={(e) => setClientId(e.target.value)}
                      autoComplete="off"
                    />
                  )}
                </AuthField>
                <AuthField id="sso-secret" label={t("fields.secret")}>
                  {(control) => (
                    <PasswordInput
                      {...control}
                      name="ssoClientSecret"
                      value={secret}
                      maxLength={4096}
                      disabled={pending}
                      onChange={(e) => setSecret(e.target.value)}
                      autoComplete="off"
                    />
                  )}
                </AuthField>
                <AuthField
                  id="sso-callback"
                  label={t("fields.callback")}
                  hint={t("fields.callbackHelp")}
                >
                  {(control) => (
                    <Input
                      {...control}
                      readOnly
                      value={callback}
                      onFocus={(e) => e.target.select()}
                    />
                  )}
                </AuthField>
              </>
            ) : (
              <>
                <AuthField id="sso-entity" label={t("fields.entityId")}>
                  {(control) => (
                    <Input
                      {...control}
                      readOnly
                      value={entityId}
                      onFocus={(e) => e.target.select()}
                    />
                  )}
                </AuthField>
                <AuthField id="sso-acs" label={t("fields.acs")}>
                  {(control) => (
                    <Input
                      {...control}
                      readOnly
                      value={acs}
                      onFocus={(e) => e.target.select()}
                    />
                  )}
                </AuthField>
                <AuthField
                  id="sso-metadata"
                  label={t("fields.metadata")}
                  hint={t("fields.metadataHelp")}
                >
                  {(control) => (
                    <Textarea
                      {...control}
                      name="ssoMetadata"
                      value={metadata}
                      maxLength={65536}
                      rows={7}
                      disabled={pending}
                      onChange={(e) => setMetadata(e.target.value)}
                      spellCheck={false}
                      className="font-mono text-meta"
                    />
                  )}
                </AuthField>
              </>
            )}
            <details className="text-small">
              <summary className="cursor-pointer text-fg-muted underline underline-offset-4">
                {t("fields.mapping")}
              </summary>
              <div className="mt-4 flex flex-col gap-4">
                <AuthField id="sso-email-claim" label={t("fields.emailClaim")}>
                  {(control) => (
                    <Input
                      {...control}
                      value={emailClaim}
                      maxLength={256}
                      disabled={pending}
                      onChange={(e) => setEmailClaim(e.target.value)}
                    />
                  )}
                </AuthField>
                <AuthField id="sso-name-claim" label={t("fields.nameClaim")}>
                  {(control) => (
                    <Input
                      {...control}
                      value={nameClaim}
                      maxLength={256}
                      disabled={pending}
                      onChange={(e) => setNameClaim(e.target.value)}
                    />
                  )}
                </AuthField>
              </div>
            </details>
            <div className="flex flex-wrap gap-3">
              <Button type="submit" variant="primary" loading={pending}>
                {t("create")}
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={pending}
                onClick={reset}
              >
                {t("cancel")}
              </Button>
            </div>
          </form>
        </SettingsSection>
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
      {fresh ? <SsoReauthenticate /> : null}
    </div>
  );
}
