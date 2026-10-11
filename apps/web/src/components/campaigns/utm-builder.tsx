"use client";

import type { CampaignView, LinkView } from "@shortn/core";
import { useTranslations } from "next-intl";
import { useId, useState } from "react";
import type { FormState } from "@/server/actions/link-pages";
import { LinkPicker } from "../editor/link-picker";
import { useFormSubmit } from "../editor/use-form-submit";
import { CopyButton } from "../page/copy-button";
import { FormActions, FormField } from "../page/form";
import { SuggestionInput } from "../page/suggestion-input";
import { Section } from "../page/page";
import { useCampaignErrorMessage } from "./campaign-errors";
import {
  builderFields,
  emptyBuilder,
  hasVariant,
  taggedUrl,
  type BuilderField,
} from "./utm-url";

const maxVariants = 50;

const suggestionsFor: Record<BuilderField, keyof CampaignView["utmDefaults"]> =
  {
    source: "sources",
    medium: "mediums",
    term: "terms",
    content: "contents",
  };

/** /campaigns/{id}/builder: tag one link for one channel, copy or save it. */
export function UtmBuilder({
  workspace,
  campaign,
  links,
  initialLink,
  canSave,
  action,
  cancelHref,
}: {
  workspace: string;
  campaign: Pick<CampaignView, "title" | "utmDefaults">;
  /** The campaign's links, offered first in the picker. */
  links: LinkView[];
  initialLink: LinkView | null;
  canSave: boolean;
  action: (state: FormState, form: FormData) => Promise<FormState>;
  cancelHref: string;
}) {
  const t = useTranslations("campaigns.builder");
  const message = useCampaignErrorMessage();
  const id = useId();
  const [link, setLink] = useState(initialLink);
  const [values, setValues] = useState(emptyBuilder);
  const [attempted, setAttempted] = useState(false);

  const url = link ? taggedUrl(link, campaign.title, values) : null;
  const duplicate = link ? hasVariant(link, campaign.title, values) : false;
  const full = link ? link.utm.length >= maxVariants : false;
  const inCampaign = link ? links.some((item) => item.id === link.id) : false;

  const { state, pending, onSubmit } = useFormSubmit(action, () => {
    setAttempted(true);
    return Boolean(link) && !duplicate && !full;
  });

  const blocked = !link
    ? message("link_required")
    : duplicate
      ? message("duplicate")
      : full
        ? message("full", { max: maxVariants })
        : null;
  const error =
    attempted && blocked
      ? blocked
      : state.error
        ? message(state.error, state.detail)
        : null;

  const set = (field: BuilderField, value: string) => {
    setAttempted(false);
    setValues((current) => ({ ...current, [field]: value }));
  };

  return (
    <form onSubmit={onSubmit} noValidate>
      <Section title={t("linkSection")} description={t("linkHint")}>
        <div className="flex flex-col gap-3">
          {link ? (
            <>
              <input type="hidden" name="link" value={link.id} />
              <p className="text-small">
                <span className="font-mono">
                  <span className="text-fg-muted">{link.domain}/</span>
                  <span className="font-medium">{link.key}</span>
                </span>
                <span className="text-fg-muted"> → {link.url}</span>
              </p>
              {inCampaign ? null : (
                <p className="text-small text-fg-muted">{t("notInCampaign")}</p>
              )}
            </>
          ) : (
            <p className="text-small text-fg-muted">{t("noLink")}</p>
          )}
          <LinkPicker
            workspace={workspace}
            suggestions={links}
            suggestionsLabel={t("campaignLinks")}
            onSelect={(next) => {
              setAttempted(false);
              setLink(next);
            }}
            trigger={
              <button
                type="button"
                className="h-8 self-start rounded-control border border-line-strong bg-field px-3 text-small font-medium hover:bg-bg-subtle focus-visible:outline-2 focus-visible:outline-signal"
              >
                {link ? t("changeLink") : t("pickLink")}
              </button>
            }
          />
        </div>
      </Section>

      <Section
        title={t("paramsSection")}
        description={t.rich("campaignParam", {
          title: campaign.title,
          code: (chunks) => <code className="font-mono text-fg">{chunks}</code>,
        })}
      >
        <div className="grid gap-5 sm:grid-cols-2">
          {builderFields.map((field) => {
            const suggestions = campaign.utmDefaults[suggestionsFor[field]];
            return (
              <div key={field} className="flex flex-col gap-2">
                <FormField
                  id={`${id}-${field}`}
                  label={t(`fields.${field}`)}
                  optional={t("optional")}
                >
                  <SuggestionInput
                    label={t(`fields.${field}`)}
                    suggestions={suggestions}
                    onValueChange={(value) => set(field, value)}
                    id={`${id}-${field}`}
                    name={field}
                    value={values[field]}
                    maxLength={100}
                    autoComplete="off"
                    autoCapitalize="none"
                    spellCheck={false}
                    placeholder={t(`placeholders.${field}`)}
                  />
                </FormField>
              </div>
            );
          })}
        </div>
      </Section>

      <Section title={t("result")} description={t("saveHint")}>
        <div className="flex flex-col gap-3">
          <output
            htmlFor={builderFields.map((field) => `${id}-${field}`).join(" ")}
            aria-live="polite"
            className="block min-h-9 rounded-control border border-line bg-bg-subtle px-3 py-2 font-mono text-small break-all"
          >
            {url ?? (
              <span className="text-fg-subtle">{t("pickLinkFirst")}</span>
            )}
          </output>
          {url ? (
            <div>
              <CopyButton
                value={url}
                label={t("copy")}
                copiedLabel={t("copied")}
              />
            </div>
          ) : null}
        </div>
      </Section>

      {error ? (
        <p role="alert" className="mt-4 text-small text-danger">
          {error}
        </p>
      ) : null}
      {canSave ? (
        <FormActions
          submitLabel={t("save")}
          cancelHref={cancelHref}
          cancelLabel={t("cancel")}
          pending={pending}
        />
      ) : (
        <p className="mt-8 border-t border-line pt-5 text-small text-fg-muted">
          {t("viewerReason")}
        </p>
      )}
    </form>
  );
}
