"use client";

import type { InviteView, MemberView } from "@shortn/core";
import { Button } from "@shortn/ui";
import { useFormatter, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { revokeInviteAction } from "@/server/actions/workspace";
import { Notice, SettingsSection } from "../section";
import { canManageMembers, type Actor } from "./roles";

export function InviteList({
  slug,
  invites,
  members,
  actor,
  now,
}: {
  slug: string;
  invites: InviteView[];
  members: MemberView[];
  actor: Actor;
  now: Date;
}) {
  const t = useTranslations("settings");
  const format = useFormatter();
  const router = useRouter();
  const manage = canManageMembers(actor);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const inviterName = (userId: string) => {
    const inviter = members.find((member) => member.userId === userId);
    return inviter ? inviter.name || inviter.email : null;
  };

  const revoke = async (invite: InviteView) => {
    setPending(invite.id);
    setError(null);
    try {
      const result = await revokeInviteAction(slug, invite.id);
      if (result.ok) router.refresh();
      else
        setError(
          result.error === "forbidden"
            ? t("members.readOnly")
            : t("common.errors.generic"),
        );
    } catch {
      setError(t("common.errors.network"));
    }
    setPending(null);
  };

  return (
    <SettingsSection
      wide
      title={t("members.invites.title", { count: invites.length })}
      {...(invites.length === 0
        ? { description: t("members.invites.empty") }
        : {})}
    >
      {error ? (
        <Notice tone="danger" live="alert">
          {error}
        </Notice>
      ) : null}
      {invites.length > 0 ? (
        <ul className="border-t border-line text-small">
          {invites.map((invite) => {
            const inviter = inviterName(invite.invitedBy);
            return (
              <li
                key={invite.id}
                className="flex min-h-14 items-center gap-3 border-b border-line py-2"
              >
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate font-medium">{invite.email}</span>
                  <span className="truncate text-meta text-fg-subtle">
                    {[
                      t(`roles.${invite.role}`),
                      t("members.invites.expires", {
                        when: format.relativeTime(
                          new Date(invite.expiresAt),
                          now,
                        ),
                      }),
                      inviter
                        ? t("members.invites.invitedBy", { name: inviter })
                        : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  loading={pending === invite.id}
                  aria-label={t("members.invites.revokeLabel", {
                    email: invite.email,
                  })}
                  {...(manage ? {} : { disabledReason: t("members.readOnly") })}
                  onClick={() => void revoke(invite)}
                >
                  {t("members.invites.revoke")}
                </Button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </SettingsSection>
  );
}
