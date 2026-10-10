"use client";

import type { CampaignView } from "@shortn/core";
import { Input, Textarea } from "@shortn/ui";
import { useTranslations } from "next-intl";
import { useId } from "react";
import { AuthField } from "../auth/auth-field";

const titleMaxLength = 80;
const descriptionMaxLength = 500;

export interface CampaignDetails {
  title: string;
  description: string;
}

export const emptyDetails: CampaignDetails = { title: "", description: "" };

/** Title and description, shared by creation and the inline edit. */
export function CampaignFields({
  values,
  onChange,
  original,
  titleError,
  autoFocus = false,
}: {
  values: CampaignDetails;
  onChange: (values: CampaignDetails) => void;
  /** The saved campaign when editing; a new title then warns about shared URLs. */
  original: CampaignView | null;
  titleError: string | undefined;
  autoFocus?: boolean;
}) {
  const t = useTranslations("campaigns.fields");
  const id = useId();
  const renaming =
    original !== null &&
    values.title.trim() !== "" &&
    values.title.trim() !== original.title;
  return (
    <>
      <AuthField
        id={`${id}-title`}
        label={t("title")}
        hint={renaming ? t("renameHint") : t("titleHint")}
        error={titleError}
      >
        {(control) => (
          <Input
            {...control}
            autoFocus={autoFocus}
            maxLength={titleMaxLength}
            value={values.title}
            onChange={(event) =>
              onChange({ ...values, title: event.target.value })
            }
          />
        )}
      </AuthField>
      <AuthField id={`${id}-description`} label={t("description")}>
        {(control) => (
          <Textarea
            {...control}
            rows={3}
            maxLength={descriptionMaxLength}
            placeholder={t("descriptionPlaceholder")}
            value={values.description}
            onChange={(event) =>
              onChange({ ...values, description: event.target.value })
            }
          />
        )}
      </AuthField>
    </>
  );
}
