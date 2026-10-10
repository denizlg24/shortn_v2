"use client";

import type { CampaignView } from "@shortn/core";
import { formatDate, formatNumber } from "@shortn/ui";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useIntlLocale } from "@/lib/intl-locale";
import { CopyButton } from "../editor/copy-button";

/** What the campaign is, above its tabs. */
export function CampaignSummary({
  workspace,
  campaign,
  canEdit,
}: {
  workspace: string;
  campaign: CampaignView;
  canEdit: boolean;
}) {
  const t = useTranslations("campaigns");
  const intlLocale = useIntlLocale();
  return (
    <section
      aria-label={t("summary.label")}
      className="flex shrink-0 flex-col gap-2 px-gutter pt-4 pb-3"
    >
      {campaign.description ? (
        <p className="max-w-3xl text-body text-pretty">
          {campaign.description}
        </p>
      ) : null}
      <dl className="flex flex-wrap items-center gap-x-6 gap-y-1.5 text-small">
        <div className="flex min-w-0 items-center gap-1.5">
          <dt className="text-fg-muted">{t("summary.param")}</dt>
          <dd className="flex min-w-0 items-center gap-0.5">
            <code className="truncate font-mono">{campaign.title}</code>
            <CopyButton text={campaign.title} label={t("actions.copyParam")} />
          </dd>
        </div>
        <div className="flex items-baseline gap-1.5">
          <dt className="text-fg-muted">{t("summary.links")}</dt>
          <dd className="font-mono tabular-nums">
            {formatNumber(campaign.linkCount, intlLocale)}
          </dd>
        </div>
        <div className="flex items-baseline gap-1.5">
          <dt className="text-fg-muted">{t("summary.created")}</dt>
          <dd className="font-mono tabular-nums">
            {formatDate(new Date(campaign.createdAt), intlLocale)}
          </dd>
        </div>
        {campaign.description || !canEdit ? null : (
          <div>
            <dt className="sr-only">{t("summary.description")}</dt>
            <dd>
              <Link
                href={`/${workspace}/campaigns/${campaign.id}/edit`}
                className="text-small text-fg-subtle underline-offset-2 hover:text-fg hover:underline"
              >
                {t("summary.addDescription")}
              </Link>
            </dd>
          </div>
        )}
      </dl>
    </section>
  );
}
