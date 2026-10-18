"use client";

import { authClient } from "@shortn/auth/client";
import { Button } from "@shortn/ui";
import { KeyRound } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { Notice, SettingsSection } from "../section";
import {
  linkableProviders,
  ProviderIcon,
  providerName,
  type SocialProvider,
} from "./providers";

export interface LinkedAccount {
  id: string;
  providerId: string;
  accountId: string;
}

export function Connections({
  accounts,
  providers,
  returnPath,
  linkError,
}: {
  accounts: LinkedAccount[];
  providers: Record<SocialProvider, boolean>;
  returnPath: string;
  linkError: string | null;
}) {
  const t = useTranslations("settings");
  const router = useRouter();
  const [pending, setPending] = useState<SocialProvider | null>(null);
  const [error, setError] = useState<string | null>(() =>
    linkError === null
      ? null
      : linkError === "email_doesn't_match"
        ? t("account.connections.errors.emailMismatch")
        : linkError === "account_already_linked_to_different_user"
          ? t("account.connections.errors.linkedElsewhere")
          : t("account.connections.errors.failed"),
  );
  const onlyMethod = accounts.length <= 1;
  const hasPassword = accounts.some(
    (account) => account.providerId === "credential",
  );
  const visible = linkableProviders.filter(
    (provider) =>
      providers[provider] ||
      accounts.some((account) => account.providerId === provider),
  );

  const connect = async (provider: SocialProvider) => {
    setPending(provider);
    setError(null);
    try {
      const { error: failure } = await authClient.linkSocial({
        provider,
        callbackURL: returnPath,
        errorCallbackURL: returnPath,
      });
      if (!failure) return;
      setError(
        failure.status === 429
          ? t("common.errors.tooManyAttempts")
          : t("account.connections.errors.failed"),
      );
    } catch {
      setError(t("common.errors.network"));
    }
    setPending(null);
  };

  const disconnect = async (
    account: LinkedAccount,
    provider: SocialProvider,
  ) => {
    setPending(provider);
    setError(null);
    try {
      const { error: failure } = await authClient.unlinkAccount({
        accountId: account.id,
      });
      if (!failure) {
        router.refresh();
      } else
        setError(
          failure.code === "YOU_CANT_UNLINK_YOUR_LAST_ACCOUNT"
            ? t("account.connections.lastMethod")
            : failure.code === "SESSION_IS_NOT_FRESH"
              ? t("account.connections.errors.notFresh")
              : t("common.errors.generic"),
        );
    } catch {
      setError(t("common.errors.network"));
    }
    setPending(null);
  };

  return (
    <SettingsSection
      title={t("account.connections.title")}
      description={t("account.connections.description")}
    >
      <ul className="border-t border-line text-small">
        <ConnectionRow
          icon={<KeyRound aria-hidden className="size-4 text-fg-muted" />}
          name={t("account.connections.credential")}
          status={
            hasPassword
              ? t("account.connections.on")
              : t("account.connections.off")
          }
        />
        {visible.map((provider) => {
          const account = accounts.find((item) => item.providerId === provider);
          return (
            <ConnectionRow
              key={provider}
              icon={<ProviderIcon provider={provider} />}
              name={providerName(provider)}
              status={
                account
                  ? t("account.connections.connected")
                  : t("account.connections.notConnected")
              }
              action={
                account ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    loading={pending === provider}
                    disabled={pending !== null && pending !== provider}
                    aria-label={t("account.connections.disconnectLabel", {
                      provider: providerName(provider),
                    })}
                    {...(onlyMethod
                      ? { disabledReason: t("account.connections.lastMethod") }
                      : {})}
                    onClick={() => void disconnect(account, provider)}
                  >
                    {t("account.connections.disconnect")}
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    loading={pending === provider}
                    disabled={pending !== null && pending !== provider}
                    aria-label={t("account.connections.connectLabel", {
                      provider: providerName(provider),
                    })}
                    onClick={() => void connect(provider)}
                  >
                    {t("account.connections.connect")}
                  </Button>
                )
              }
            />
          );
        })}
      </ul>
      {error ? (
        <Notice tone="danger" live="alert">
          {error}
        </Notice>
      ) : null}
    </SettingsSection>
  );
}

function ConnectionRow({
  icon,
  name,
  status,
  action,
}: {
  icon: ReactNode;
  name: string;
  status: string;
  action?: ReactNode;
}) {
  return (
    <li className="flex min-h-12 items-center gap-3 border-b border-line py-2">
      <span className="grid size-5 shrink-0 place-items-center">{icon}</span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="font-medium">{name}</span>
        <span className="text-meta text-fg-subtle">{status}</span>
      </span>
      {action}
    </li>
  );
}
