"use client";

import type { MemberView } from "@shortn/core";
import {
  Button,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@shortn/ui";
import { ChevronDown } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { UserAvatar } from "@/components/shell/avatars";
import {
  changeRoleAction,
  removeMemberAction,
} from "@/server/actions/workspace";
import { ConfirmDialog } from "../confirm-dialog";
import { Notice, SettingsSection } from "../section";
import {
  assignableRoles,
  isAssignableRole,
  memberBlock,
  type Actor,
} from "./roles";

type Pending = { member: MemberView; kind: "remove" | "leave" };

export function MemberList({
  workspace,
  members,
  actor,
}: {
  workspace: { slug: string; name: string };
  members: MemberView[];
  actor: Actor;
}) {
  const t = useTranslations("settings");
  const router = useRouter();
  const [confirming, setConfirming] = useState<Pending | null>(null);
  const [error, setError] = useState<string | null>(null);

  const errorMessage = (code: string) => {
    switch (code) {
      case "forbidden":
        return t("members.list.adminOwnerOnly");
      case "owner_protected":
        return t("members.errors.ownerProtected");
      case "not_found":
        return t("members.errors.notFound");
      default:
        return t("common.errors.generic");
    }
  };

  const remove = async () => {
    if (!confirming) return null;
    const result = await removeMemberAction(
      workspace.slug,
      confirming.member.userId,
    );
    if (!result.ok) return errorMessage(result.error);
    if (confirming.kind === "leave") {
      window.location.assign("/");
      return null;
    }
    setConfirming(null);
    router.refresh();
    return null;
  };

  const name = (member: MemberView) =>
    member.name || member.email || t("members.list.noName");

  return (
    <SettingsSection
      wide
      title={t("members.list.title", { count: members.length })}
    >
      {error ? (
        <Notice tone="danger" live="alert">
          {error}
        </Notice>
      ) : null}
      <table className="w-full table-fixed border-collapse text-small">
        <thead className="sr-only">
          <tr>
            <th scope="col">{t("members.list.member")}</th>
            <th scope="col">{t("members.list.role")}</th>
            <th scope="col">{t("members.list.actions")}</th>
          </tr>
        </thead>
        <tbody className="border-t border-line">
          {members.map((member) => (
            <MemberRow
              key={`${member.userId}:${member.role}`}
              slug={workspace.slug}
              member={member}
              actor={actor}
              displayName={name(member)}
              onError={setError}
              errorMessage={errorMessage}
              onRemove={() =>
                setConfirming({
                  member,
                  kind: member.userId === actor.userId ? "leave" : "remove",
                })
              }
            />
          ))}
        </tbody>
      </table>
      <ConfirmDialog
        open={confirming !== null}
        onOpenChange={(open) => {
          if (!open) setConfirming(null);
        }}
        title={
          confirming?.kind === "leave"
            ? t("members.leave.title", { workspace: workspace.name })
            : t("members.remove.title", {
                name: confirming ? name(confirming.member) : "",
              })
        }
        description={
          confirming?.kind === "leave"
            ? t("members.leave.body")
            : t("members.remove.body", { workspace: workspace.name })
        }
        confirmLabel={
          confirming?.kind === "leave"
            ? t("members.leave.confirm")
            : t("members.remove.confirm")
        }
        onConfirm={remove}
      />
    </SettingsSection>
  );
}

function MemberRow({
  slug,
  member,
  actor,
  displayName,
  onError,
  errorMessage,
  onRemove,
}: {
  slug: string;
  member: MemberView;
  actor: Actor;
  displayName: string;
  onError: (message: string | null) => void;
  errorMessage: (code: string) => string;
  onRemove: () => void;
}) {
  const t = useTranslations("settings");
  const router = useRouter();
  const [role, setRole] = useState(member.role);
  const [pending, setPending] = useState(false);
  const self = member.userId === actor.userId;
  const owner = member.role === "owner";
  const block = memberBlock(actor, member);
  const blockReason = block ? t(`members.list.${block}`) : null;

  const changeRole = async (next: string) => {
    if (!isAssignableRole(next) || next === role) return;
    const previous = role;
    setRole(next);
    setPending(true);
    onError(null);
    try {
      const result = await changeRoleAction(slug, member.userId, next);
      if (result.ok) router.refresh();
      else {
        setRole(previous);
        onError(errorMessage(result.error));
      }
    } catch {
      setRole(previous);
      onError(t("common.errors.network"));
    }
    setPending(false);
  };

  const roleLabel = t(`roles.${role}`);

  return (
    <tr className="border-b border-line">
      <td className="py-2.5 pr-3">
        <div className="flex min-w-0 items-center gap-3">
          <UserAvatar name={displayName} image={member.image} />
          <div className="flex min-w-0 flex-col">
            <span className="flex min-w-0 items-baseline gap-2">
              <span className="truncate font-medium">{displayName}</span>
              {self ? (
                <span className="shrink-0 rounded-chip bg-bg-muted px-1.5 text-meta text-fg-muted">
                  {t("common.you")}
                </span>
              ) : null}
            </span>
            {member.name && member.email ? (
              <span className="truncate text-meta text-fg-subtle">
                {member.email}
              </span>
            ) : null}
          </div>
        </div>
      </td>
      <td className="w-32 py-2.5 pr-3 sm:w-36">
        {owner || self ? (
          <span className="px-2.5 text-fg-muted">{roleLabel}</span>
        ) : blockReason ? (
          <Button
            size="sm"
            className="w-full justify-between"
            disabledReason={blockReason}
            aria-label={t("members.list.changeRole", { name: displayName })}
          >
            <span className="truncate">{roleLabel}</span>
            <ChevronDown aria-hidden className="text-fg-subtle" />
          </Button>
        ) : (
          <Select value={role} onValueChange={changeRole} disabled={pending}>
            <SelectTrigger
              size="sm"
              aria-label={t("members.list.changeRole", { name: displayName })}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {assignableRoles(actor).map((option) => (
                <SelectItem key={option} value={option}>
                  {t(`roles.${option}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </td>
      <td className="w-24 py-2.5 text-right">
        {owner ? null : self ? (
          <Button size="sm" variant="ghost" onClick={onRemove}>
            {t("members.list.leave")}
          </Button>
        ) : (
          <Button
            size="sm"
            variant="ghost"
            onClick={onRemove}
            disabled={pending}
            aria-label={t("members.list.removeLabel", { name: displayName })}
            {...(blockReason ? { disabledReason: blockReason } : {})}
          >
            {t("members.list.remove")}
          </Button>
        )}
      </td>
    </tr>
  );
}
