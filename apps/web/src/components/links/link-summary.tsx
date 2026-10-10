"use client";

import type { LinkView } from "@shortn/core";
import {
  Button,
  Destination,
  formatDate,
  ShortLink,
  TagChips,
  Tooltip,
} from "@shortn/ui";
import { ExternalLink, KeyRound, Pencil } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useIntlLocale } from "@/lib/intl-locale";
import { SafetyStatus } from "./safety-status";

/** The link's identity above its analytics: what it is, where it goes, how it's set up. */
export function LinkSummary({
  workspace,
  link,
  canEdit,
}: {
  workspace: string;
  link: LinkView;
  canEdit: boolean;
}) {
  const t = useTranslations("links");
  const intlLocale = useIntlLocale();
  return (
    <section
      aria-label={t("summary.label")}
      className="flex flex-col gap-3 border-b border-line px-gutter py-4"
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <ShortLink
          domain={link.domain}
          linkKey={link.key}
          size="lg"
          className="max-w-full"
        />
        <div className="flex min-w-0 flex-1 items-center gap-1">
          <Destination url={link.url} className="min-w-0" />
          <Tooltip content={t("sheet.openDestination")}>
            <a
              href={link.url}
              target="_blank"
              rel="noreferrer noopener"
              aria-label={t("sheet.openDestination")}
              className="grid size-7 shrink-0 place-items-center rounded-control text-fg-subtle hover:bg-bg-muted hover:text-fg"
            >
              <ExternalLink aria-hidden className="size-4" />
            </a>
          </Tooltip>
        </div>
        <Button asChild variant="secondary">
          <Link
            href={{
              pathname: `/${workspace}/links`,
              query: { link: link.id },
            }}
          >
            <Pencil aria-hidden />
            {canEdit ? t("summary.edit") : t("summary.open")}
          </Link>
        </Button>
      </div>
      <dl className="flex flex-wrap items-center gap-x-6 gap-y-1.5 text-small">
        <div className="flex items-baseline gap-1.5">
          <dt className="text-fg-muted">{t("overview.created")}</dt>
          <dd className="font-mono tabular-nums">
            {formatDate(new Date(link.createdAt), intlLocale)}
          </dd>
        </div>
        {link.tags.length > 0 ? (
          <div className="flex min-w-0 items-center gap-1.5">
            <dt className="sr-only">{t("overview.tags")}</dt>
            <dd className="min-w-0">
              <TagChips tags={link.tags.map((tag) => tag.name)} max={6} />
            </dd>
          </div>
        ) : null}
        {link.password ? (
          <div className="flex items-center gap-1.5 text-fg-muted">
            <dt className="sr-only">{t("overview.password")}</dt>
            <dd className="inline-flex items-center gap-1.5">
              <KeyRound aria-hidden className="size-3.5" />
              {t("overview.passwordOn")}
            </dd>
          </div>
        ) : null}
        <div className="flex items-baseline gap-1.5">
          <dt className="text-fg-muted">{t("overview.safety")}</dt>
          <dd>
            <SafetyStatus safety={link.safety} />
          </dd>
        </div>
      </dl>
    </section>
  );
}
