"use client";

import type { CampaignView, LinkView } from "@shortn/core";
import { Button, cn, Destination, fieldFrame, Input } from "@shortn/ui";
import { ChevronsUpDown } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { setLinkUtmAction } from "@/server/actions/links";
import { AuthField } from "../auth/auth-field";
import { ErrorText, settle, type ActionError } from "../editor/action-error";
import { CopyButton } from "../editor/copy-button";
import { EditorSection } from "../editor/editor-section";
import { LinkPicker } from "../editor/link-picker";
import { Notice } from "../settings/section";
import { useCampaignError, type CampaignField } from "./campaign-errors";
import {
  builderFields,
  emptyBuilder,
  hasVariant,
  taggedUrl,
  withVariant,
  type BuilderField,
} from "./utm-url";

const maxVariants = 50;
const valueMaxLength = 100;

const suggestionsFor: Record<BuilderField, keyof CampaignView["utmDefaults"]> =
  {
    source: "sources",
    medium: "mediums",
    term: "terms",
    content: "contents",
  };

/** Composes a tagged URL for one link, with the campaign's defaults one click away. */
export function UtmBuilder({
  workspace,
  campaign,
  links,
  canEdit,
}: {
  workspace: string;
  campaign: CampaignView;
  /** The campaign's links, offered first. */
  links: LinkView[];
  canEdit: boolean;
}) {
  const t = useTranslations("campaigns.builder");
  const router = useRouter();
  const toError = useCampaignError();
  const id = useId();
  const [link, setLink] = useState<LinkView | null>(links[0] ?? null);
  const [values, setValues] = useState(emptyBuilder);
  const [pending, setPending] = useState(false);
  const [savedTo, setSavedTo] = useState<string | null>(null);
  const [error, setError] = useState<ActionError<CampaignField> | null>(null);

  const inCampaign = link ? links.some((item) => item.id === link.id) : false;
  const url = link ? taggedUrl(link, campaign.title, values) : null;
  const duplicate = link ? hasVariant(link, campaign.title, values) : false;
  const full = link ? link.utm.length >= maxVariants : false;

  const set = (field: BuilderField, value: string) => {
    setSavedTo(null);
    setError(null);
    setValues((current) => ({ ...current, [field]: value }));
  };

  const saveVariant = async () => {
    if (!link || pending) return;
    setPending(true);
    setError(null);
    const result = await settle(
      setLinkUtmAction(
        workspace,
        link.id,
        withVariant(link, campaign.title, values),
      ),
    );
    setPending(false);
    if (!result.ok) {
      setError(toError(result));
      return;
    }
    const variant = {
      source: values.source.trim() || null,
      medium: values.medium.trim() || null,
      campaign: campaign.title,
      term: values.term.trim() || null,
      content: values.content.trim() || null,
    };
    setLink({ ...link, utm: [...link.utm, variant] });
    setSavedTo(`${link.domain}/${link.key}`);
    router.refresh();
  };

  const saveReason = !canEdit
    ? t("viewerReason")
    : duplicate
      ? t("duplicate")
      : full
        ? t("full", { max: maxVariants })
        : null;

  return (
    <div className="flex flex-col pb-10">
      <EditorSection title={t("title")} description={t("description")}>
        <div className="flex max-w-140 flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <span id={`${id}-link`} className="text-small font-medium">
              {t("link")}
            </span>
            <LinkPicker
              workspace={workspace}
              suggestions={links}
              suggestionsLabel={t("campaignLinks")}
              onSelect={(next) => {
                setLink(next);
                setSavedTo(null);
                setError(null);
              }}
              trigger={
                <button
                  type="button"
                  aria-labelledby={`${id}-link`}
                  aria-haspopup="dialog"
                  className={cn(
                    fieldFrame,
                    "flex h-8 w-full cursor-pointer items-center justify-between gap-2 px-2.5 text-left text-small outline-none focus-visible:border-signal focus-visible:ring-1 focus-visible:ring-signal",
                  )}
                >
                  {link ? (
                    <span className="min-w-0 truncate">
                      <span className="text-fg-muted">{link.domain}/</span>
                      <span className="font-medium">{link.key}</span>
                    </span>
                  ) : (
                    <span className="text-fg-subtle">{t("pickLink")}</span>
                  )}
                  <ChevronsUpDown
                    aria-hidden
                    className="size-4 shrink-0 text-fg-subtle"
                  />
                </button>
              }
            />
            {link ? (
              <Destination url={link.url} className="min-w-0 text-meta" />
            ) : null}
          </div>
          {link && !inCampaign ? (
            <Notice tone="neutral">{t("notInCampaign")}</Notice>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            {builderFields.map((field) => {
              const suggestions = campaign.utmDefaults[suggestionsFor[field]];
              return (
                <AuthField
                  key={field}
                  id={`${id}-${field}`}
                  label={t(`fields.${field}`)}
                  after={
                    suggestions.length ? (
                      <ul
                        aria-label={t("suggestions", {
                          field: t(`fields.${field}`),
                        })}
                        className="flex flex-wrap gap-1"
                      >
                        {suggestions.map((suggestion) => (
                          <li key={suggestion}>
                            <button
                              type="button"
                              aria-pressed={values[field] === suggestion}
                              onClick={() => set(field, suggestion)}
                              className="inline-flex h-6 max-w-40 cursor-pointer items-center rounded-chip bg-fg/6 px-1.5 font-mono text-meta text-fg-muted hover:bg-fg/10 hover:text-fg focus-visible:outline-2 focus-visible:outline-signal aria-pressed:bg-signal-wash aria-pressed:text-fg"
                            >
                              <span className="truncate">{suggestion}</span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    ) : undefined
                  }
                >
                  {(control) => (
                    <Input
                      {...control}
                      value={values[field]}
                      maxLength={valueMaxLength}
                      autoComplete="off"
                      autoCapitalize="none"
                      spellCheck={false}
                      placeholder={t(`placeholders.${field}`)}
                      onChange={(event) => set(field, event.target.value)}
                    />
                  )}
                </AuthField>
              );
            })}
          </div>
          <p className="text-meta text-fg-muted">
            {t.rich("campaignParam", {
              title: campaign.title,
              code: (chunks) => (
                <code className="font-mono text-fg">{chunks}</code>
              ),
            })}
          </p>
        </div>
      </EditorSection>

      <EditorSection title={t("result")}>
        <div className="flex max-w-140 flex-col gap-3">
          <output
            htmlFor={builderFields.map((field) => `${id}-${field}`).join(" ")}
            aria-live="polite"
            className={cn(
              fieldFrame,
              "block min-h-8 px-2.5 py-1.5 font-mono text-small break-all hover:border-line-strong",
              !url && "text-fg-subtle",
            )}
          >
            {url ?? t("pickLinkFirst")}
          </output>
          <div className="flex flex-wrap items-center gap-2">
            <CopyButton
              text={url ?? ""}
              label={t("copy")}
              variant="primary"
              disabled={!url}
            >
              {t("copy")}
            </CopyButton>
            <Button
              loading={pending}
              disabled={!link}
              onClick={() => void saveVariant()}
              {...(saveReason && link ? { disabledReason: saveReason } : {})}
            >
              {t("save")}
            </Button>
            {savedTo ? (
              <p role="status" className="text-small text-fg-muted">
                {t("saved", { link: savedTo })}
              </p>
            ) : null}
          </div>
          <p className="text-meta text-pretty text-fg-muted">{t("saveHint")}</p>
          {error ? <ErrorText error={error} /> : null}
        </div>
      </EditorSection>
    </div>
  );
}
