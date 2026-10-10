"use client";

import { Button } from "@shortn/ui";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { createCampaignAction } from "@/server/actions/campaigns";
import { ErrorText, settle, type ActionError } from "../editor/action-error";
import { FormPage } from "../editor/form-page";
import { useCampaignError, type CampaignField } from "./campaign-errors";
import { CampaignFields, emptyDetails } from "./campaign-fields";

/** campaigns/new: a title (its utm_campaign) and an optional description. */
export function CampaignCreateForm({ workspace }: { workspace: string }) {
  const t = useTranslations("campaigns.createPage");
  const router = useRouter();
  const toError = useCampaignError();
  const [values, setValues] = useState(emptyDetails);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<ActionError<CampaignField> | null>(null);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending) return;
    const title = values.title.trim();
    if (!title) {
      setError({ field: "title", message: t("titleRequired") });
      return;
    }
    const description = values.description.trim();
    setPending(true);
    setError(null);
    const result = await settle(
      createCampaignAction(workspace, {
        title,
        ...(description ? { description } : {}),
      }),
    );
    if (!result.ok) {
      setPending(false);
      setError(toError(result));
      return;
    }
    router.push(`/${workspace}/campaigns/${result.data.id}`);
  };

  return (
    <FormPage
      trail={[{ href: `/${workspace}/campaigns`, label: t("section") }]}
      title={t("title")}
      description={t("description")}
      onSubmit={submit}
      cancelLabel={t("cancel")}
      submit={
        <Button type="submit" variant="primary" loading={pending}>
          {t("submit")}
        </Button>
      }
    >
      <CampaignFields
        values={values}
        onChange={setValues}
        original={null}
        titleError={error?.field === "title" ? error.message : undefined}
        autoFocus
      />
      {error && error.field === "form" ? <ErrorText error={error} /> : null}
    </FormPage>
  );
}
