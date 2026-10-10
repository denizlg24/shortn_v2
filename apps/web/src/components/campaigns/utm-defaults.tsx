"use client";

import type { CampaignView, UtmDefaults } from "@shortn/core";
import { useTranslations } from "next-intl";
import { useId, useState, type FormEvent } from "react";
import { updateCampaignAction } from "@/server/actions/campaigns";
import { AuthField } from "../auth/auth-field";
import { ErrorText, settle, type ActionError } from "../editor/action-error";
import { EditorSection } from "../editor/editor-section";
import { SaveRow } from "../settings/save-row";
import { useCampaignError, type CampaignField } from "./campaign-errors";
import { ChipListField } from "./chip-list-field";

const lists = ["sources", "mediums", "terms", "contents"] as const;

const same = (a: UtmDefaults, b: UtmDefaults) =>
  lists.every((list) => a[list].join("\n") === b[list].join("\n"));

/** The values the builder suggests for this campaign. */
export function UtmDefaultsForm({
  workspace,
  campaign,
  canEdit,
  onSaved,
}: {
  workspace: string;
  campaign: CampaignView;
  canEdit: boolean;
  onSaved: (campaign: CampaignView) => void;
}) {
  const t = useTranslations("campaigns.defaults");
  const toError = useCampaignError();
  const id = useId();
  const [values, setValues] = useState(campaign.utmDefaults);
  const [pending, setPending] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<ActionError<CampaignField> | null>(null);
  const dirty = !same(values, campaign.utmDefaults);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!dirty || pending) return;
    setPending(true);
    setError(null);
    const result = await settle(
      updateCampaignAction(workspace, campaign.id, { utmDefaults: values }),
    );
    setPending(false);
    if (!result.ok) {
      setError(toError(result));
      return;
    }
    setValues(result.data.utmDefaults);
    setSaved(true);
    onSaved(result.data);
  };

  return (
    <EditorSection title={t("title")} description={t("description")}>
      <form
        noValidate
        onSubmit={submit}
        className="flex max-w-140 flex-col gap-4"
      >
        {lists.map((list) => (
          <AuthField
            key={list}
            id={`${id}-${list}`}
            label={t(`lists.${list}`)}
            hint={t(`hints.${list}`)}
          >
            {(control) => (
              <ChipListField
                control={control}
                values={values[list]}
                placeholder={t(`placeholders.${list}`)}
                disabled={!canEdit}
                onChange={(next) => {
                  setSaved(false);
                  setValues((current) => ({ ...current, [list]: next }));
                }}
              />
            )}
          </AuthField>
        ))}
        {error ? <ErrorText error={error} /> : null}
        <SaveRow
          saved={saved && !dirty}
          pending={pending}
          disabled={!dirty}
          label={t("save")}
          {...(canEdit ? {} : { disabledReason: t("viewerReason") })}
        />
      </form>
    </EditorSection>
  );
}
