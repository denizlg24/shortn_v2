"use client";

import { authClient } from "@shortn/auth/client";
import { Button } from "@shortn/ui";
import { Monitor, Smartphone } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Notice, SettingsSection } from "../section";
import type { DeviceInfo } from "./user-agent";

export interface SessionRow {
  id: string;
  /** Null for the current session, which is never revoked from this list. */
  token: string | null;
  current: boolean;
  impersonated: boolean;
  device: DeviceInfo;
  location: string | null;
  lastActive: string;
}

export function Sessions({ sessions }: { sessions: SessionRow[] }) {
  const t = useTranslations("settings");
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const others = sessions.filter((session) => !session.current);

  const run = async (
    key: string,
    request: () => Promise<{ error: unknown }>,
  ) => {
    setPending(key);
    setError(null);
    try {
      const { error: failure } = await request();
      if (failure) setError(t("common.errors.generic"));
      else router.refresh();
    } catch {
      setError(t("common.errors.network"));
    }
    setPending(null);
  };

  const deviceLabel = ({ browser, os }: DeviceInfo) =>
    browser && os
      ? t("account.sessions.device", { browser, os })
      : (browser ?? os ?? t("account.sessions.unknownDevice"));

  return (
    <SettingsSection
      title={t("account.sessions.title")}
      description={t("account.sessions.description")}
      aside={
        others.length > 0 ? (
          <Button
            size="sm"
            loading={pending === "others"}
            disabled={pending !== null && pending !== "others"}
            onClick={() =>
              void run("others", () => authClient.revokeOtherSessions())
            }
          >
            {t("account.sessions.revokeOthers")}
          </Button>
        ) : null
      }
    >
      <ul className="border-t border-line text-small">
        {sessions.map((session) => {
          const label = deviceLabel(session.device);
          const Icon = session.device.mobile ? Smartphone : Monitor;
          const token = session.token;
          return (
            <li
              key={session.id}
              className="flex min-h-14 items-center gap-3 border-b border-line py-2"
            >
              <Icon aria-hidden className="size-4 shrink-0 text-fg-muted" />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="flex min-w-0 items-baseline gap-2">
                  <span className="truncate font-medium">{label}</span>
                  {session.current ? (
                    <span className="shrink-0 rounded-chip bg-signal-wash px-1.5 text-meta font-medium text-signal">
                      {t("account.sessions.thisDevice")}
                    </span>
                  ) : null}
                  {session.impersonated ? (
                    <span className="shrink-0 rounded-chip bg-bg-muted px-1.5 text-meta text-fg-muted">
                      {t("account.sessions.support")}
                    </span>
                  ) : null}
                </span>
                <span className="truncate text-meta text-fg-subtle">
                  {[
                    session.location ?? t("account.sessions.unknownLocation"),
                    session.current
                      ? null
                      : t("account.sessions.lastActive", {
                          when: session.lastActive,
                        }),
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </span>
              {token ? (
                <Button
                  size="sm"
                  variant="ghost"
                  loading={pending === session.id}
                  disabled={pending !== null && pending !== session.id}
                  aria-label={t("account.sessions.revokeLabel", {
                    device: label,
                  })}
                  onClick={() =>
                    void run(session.id, () =>
                      authClient.revokeSession({ token }),
                    )
                  }
                >
                  {t("account.sessions.revoke")}
                </Button>
              ) : null}
            </li>
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
