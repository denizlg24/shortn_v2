"use client";

import {
  Button,
  cn,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@shortn/ui";
import { Mail } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { FormAlert } from "@/components/auth/auth-parts";
import { useAuthForm } from "@/components/auth/use-auth-form";
import { isEmail } from "@/components/auth/rules";
import { inviteMemberAction } from "@/server/actions/workspace";
import { Notice, SettingsSection, textAction } from "../section";
import { settingsHref } from "../tabs";
import {
  assignableRoles,
  canManageMembers,
  isAssignableRole,
  type Actor,
  type AssignableRole,
} from "./roles";
import { strong } from "@/lib/rich-text";

export function InviteSection({
  slug,
  actor,
  seats,
  canUpgrade,
}: {
  slug: string;
  actor: Actor;
  seats: { used: number; limit: number | null };
  canUpgrade: boolean;
}) {
  const t = useTranslations("settings");
  const manage = canManageMembers(actor);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [seatLimit, setSeatLimit] = useState<number | null>(null);
  // A fresh form after each invite, so the cleared field isn't flagged.
  const [round, setRound] = useState(0);

  const full = seats.limit !== null && seats.used >= seats.limit;
  const upgrade = canUpgrade ? (
    <Link href={settingsHref(slug, "billing")} className={textAction}>
      {t("common.seePlans")}
    </Link>
  ) : null;

  return (
    <SettingsSection
      title={t("members.invite.title")}
      description={manage ? undefined : t("members.readOnly")}
    >
      <InviteForm
        key={round}
        slug={slug}
        actor={actor}
        fallbackSeats={seats.limit}
        onSent={(email) => {
          setSentTo(email);
          setRound((value) => value + 1);
        }}
        onSeatsExhausted={setSeatLimit}
        onEdit={() => {
          setSentTo(null);
          setSeatLimit(null);
        }}
      />
      {seatLimit !== null ? (
        <Notice tone="danger" live="alert" action={upgrade}>
          {t(
            canUpgrade
              ? "members.invite.errors.seatsExhausted"
              : "members.invite.errors.seatsExhaustedAskOwner",
            { seats: seatLimit },
          )}
        </Notice>
      ) : null}
      {sentTo ? (
        <Notice tone="success" live="status">
          {t.rich("members.invite.sent", { email: sentTo, strong })}
        </Notice>
      ) : null}
      {seats.limit !== null && seatLimit === null ? (
        <p
          className={cn(
            "flex flex-wrap items-baseline gap-x-3 text-meta",
            full ? "text-warning" : "text-fg-subtle",
          )}
        >
          <span>
            {t("members.invite.seats", {
              used: seats.used,
              limit: seats.limit,
            })}
          </span>
          {full && upgrade ? upgrade : null}
        </p>
      ) : null}
    </SettingsSection>
  );
}

function InviteForm({
  slug,
  actor,
  fallbackSeats,
  onSent,
  onSeatsExhausted,
  onEdit,
}: {
  slug: string;
  actor: Actor;
  fallbackSeats: number | null;
  onSent: (email: string) => void;
  onSeatsExhausted: (seats: number) => void;
  onEdit: () => void;
}) {
  const t = useTranslations("settings");
  const router = useRouter();
  const roleId = useId();
  const manage = canManageMembers(actor);
  const [role, setRole] = useState<AssignableRole>("member");
  const form = useAuthForm(
    { email: "" },
    (values) => ({
      email: !values.email.trim()
        ? t("members.invite.errors.emailRequired")
        : isEmail(values.email.trim())
          ? undefined
          : t("members.invite.errors.emailInvalid"),
    }),
    { fallbackError: t("common.errors.network") },
  );

  const onSubmit = form.submit(async (values) => {
    onEdit();
    const email = values.email.trim();
    const result = await inviteMemberAction(slug, { email, role });
    if (result.ok) {
      onSent(result.data.email);
      router.refresh();
      return "done";
    }
    switch (result.error) {
      case "invalid_email":
      case "invalid_input":
        return {
          field: "email",
          error: t("members.invite.errors.emailInvalid"),
        };
      case "already_member":
        return {
          field: "email",
          error: t("members.invite.errors.alreadyMember"),
        };
      case "seats_exhausted": {
        const max = result.detail?.seats;
        onSeatsExhausted(typeof max === "number" ? max : (fallbackSeats ?? 1));
        return "done";
      }
      case "forbidden":
        return { formError: t("members.readOnly") };
      default:
        return { formError: t("common.errors.generic") };
    }
  });

  return (
    <form noValidate onSubmit={onSubmit} className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-2">
        <div className="flex min-w-48 flex-1 flex-col gap-1.5">
          <Label htmlFor={form.id("email")}>{t("members.invite.email")}</Label>
          <Input
            {...form.field("email")}
            onChange={(event) => {
              onEdit();
              form.setValue("email", event.target.value);
            }}
            type="email"
            inputMode="email"
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            placeholder={t("members.invite.emailPlaceholder")}
            disabled={!manage}
            aria-invalid={form.errorFor("email") ? true : undefined}
            aria-describedby={
              form.errorFor("email") ? `${form.id("email")}-error` : undefined
            }
            leading={<Mail aria-hidden />}
          />
        </div>
        <div className="flex w-32 flex-col gap-1.5">
          <Label htmlFor={roleId}>{t("members.invite.role")}</Label>
          <Select
            value={role}
            onValueChange={(value) => {
              if (isAssignableRole(value)) setRole(value);
            }}
            disabled={!manage}
          >
            <SelectTrigger id={roleId}>
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
        </div>
        <Button
          type="submit"
          variant="primary"
          loading={form.pending}
          {...(manage ? {} : { disabledReason: t("members.readOnly") })}
        >
          {t("members.invite.submit")}
        </Button>
      </div>
      {form.errorFor("email") ? (
        <p id={`${form.id("email")}-error`} className="text-meta text-danger">
          {form.errorFor("email")}
        </p>
      ) : (
        <p className="text-meta text-pretty text-fg-muted">
          {t(`roleDescriptions.${role}`)}
        </p>
      )}
      {form.formError ? <FormAlert>{form.formError}</FormAlert> : null}
    </form>
  );
}
