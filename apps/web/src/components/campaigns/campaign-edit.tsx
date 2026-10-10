"use client";

import type { CampaignView } from "@shortn/core";
import { buttonVariants } from "@shortn/ui";
import { ArrowLeft } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { updateCampaignAction } from "@/server/actions/campaigns";
import { ErrorText, settle, type ActionError } from "../editor/action-error";
import { EditorSection } from "../editor/editor-section";
import { SaveRow } from "../settings/save-row";
import { BreadcrumbTitle } from "../shell/breadcrumb-title";
import { PageHeader } from "../shell/page-header";
import { useCampaignError, type CampaignField } from "./campaign-errors";
import { CampaignFields } from "./campaign-fields";
import { UtmDefaultsForm } from "./utm-defaults";

/** campaigns/[id]/edit: the campaign's settings, each section saved on its own. */
export function CampaignEdit({
  workspace,
  campaign: initial,
}: {
  workspace: string;
  campaign: CampaignView;
}) {
  const t = useTranslations("campaigns");
  const router = useRouter();
  const [campaign, setCampaign] = useState(initial);
  const detailHref = `/${workspace}/campaigns/${campaign.id}` as const;

  const saved = (next: CampaignView) => {
    setCampaign(next);
    router.refresh();
  };

  return (
    <>
      <PageHeader
        title={
          <BreadcrumbTitle
            trail={[
              { href: `/${workspace}/campaigns`, label: t("title") },
              { href: detailHref, label: campaign.title },
            ]}
          >
            {t("editPage.title")}
          </BreadcrumbTitle>
        }
      >
        <Link
          href={detailHref}
          className={buttonVariants({ variant: "ghost", className: "ml-auto" })}
        >
          <ArrowLeft aria-hidden />
          {t("editPage.back")}
        </Link>
      </PageHeader>
      <div className="pb-10">
        <DetailsForm
          workspace={workspace}
          campaign={campaign}
          onSaved={saved}
        />
        <UtmDefaultsForm
          workspace={workspace}
          campaign={campaign}
          canEdit
          onSaved={saved}
        />
      </div>
    </>
  );
}

function DetailsForm({
  workspace,
  campaign,
  onSaved,
}: {
  workspace: string;
  campaign: CampaignView;
  onSaved: (campaign: CampaignView) => void;
}) {
  const t = useTranslations("campaigns");
  const toError = useCampaignError();
  const [values, setValues] = useState({
    title: campaign.title,
    description: campaign.description ?? "",
  });
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<ActionError<CampaignField> | null>(null);
  const title = values.title.trim();
  const description = values.description.trim();
  const dirty =
    title !== campaign.title || description !== (campaign.description ?? "");

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending || !dirty) return;
    if (!title) {
      setError({ field: "title", message: t("createPage.titleRequired") });
      return;
    }
    setPending(true);
    setError(null);
    const result = await settle(
      updateCampaignAction(workspace, campaign.id, {
        ...(title !== campaign.title ? { title } : {}),
        ...(description !== (campaign.description ?? "")
          ? { description: description || null }
          : {}),
      }),
    );
    setPending(false);
    if (!result.ok) {
      setError(toError(result));
      return;
    }
    setDone(true);
    onSaved(result.data);
  };

  return (
    <EditorSection title={t("editPage.details")}>
      <form
        noValidate
        onSubmit={submit}
        className="flex max-w-140 flex-col gap-4"
      >
        <CampaignFields
          values={values}
          onChange={(next) => {
            setDone(false);
            setValues(next);
          }}
          original={campaign}
          titleError={error?.field === "title" ? error.message : undefined}
        />
        {error && error.field === "form" ? <ErrorText error={error} /> : null}
        <SaveRow
          saved={done && !dirty}
          pending={pending}
          disabled={!dirty}
          label={t("editPage.saveDetails")}
        />
      </form>
    </EditorSection>
  );
}
