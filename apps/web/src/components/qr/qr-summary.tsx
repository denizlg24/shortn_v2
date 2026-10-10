"use client";

import type { QrView } from "@shortn/core";
import {
  announce,
  Button,
  buttonVariants,
  Destination,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  formatDate,
  ShortLink,
  TagChips,
  Tooltip,
} from "@shortn/ui";
import { Ellipsis, ExternalLink, Pencil, Trash } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useIntlLocale } from "@/lib/intl-locale";
import { deleteQrsAction } from "@/server/actions/qr";
import { settle } from "../editor/action-error";
import { ConfirmDialog } from "../settings/confirm-dialog";
import { QrDownloadMenu } from "./qr-download-menu";
import { useQrError } from "./qr-errors";
import { QrImage } from "./qr-image";
import { stylingOptions } from "./qr-render";

/** The code above its scans on the detail page: what it is and where it goes. */
export function QrSummary({
  workspace,
  qr,
  canEdit,
}: {
  workspace: string;
  qr: QrView;
  canEdit: boolean;
}) {
  const t = useTranslations("qr");
  const router = useRouter();
  const intlLocale = useIntlLocale();
  const toError = useQrError();
  const [confirming, setConfirming] = useState(false);
  const options = useMemo(
    () => stylingOptions(qr.design, qr.shortUrl),
    [qr.design, qr.shortUrl],
  );
  const domain = new URL(qr.shortUrl).host;

  const confirmDelete = async (): Promise<string | null> => {
    const result = await settle(deleteQrsAction(workspace, [qr.id]));
    if (!result.ok) return toError(result).message;
    announce(t("delete.done", { count: 1 }));
    router.replace(`/${workspace}/qr`);
    return null;
  };

  return (
    <section
      aria-label={t("detail.summary")}
      className="flex flex-wrap items-start gap-x-6 gap-y-4 border-b border-line px-gutter py-5"
    >
      <QrImage
        options={options}
        size={96}
        alt={t("preview.alt", { link: `${domain}/${qr.key}` })}
      />
      <div className="flex min-w-0 flex-1 basis-72 flex-col gap-3">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <ShortLink
            domain={domain}
            linkKey={qr.key}
            size="lg"
            className="max-w-full"
          />
          <div className="flex min-w-0 flex-1 items-center gap-1">
            <Destination url={qr.url} className="min-w-0" />
            <Tooltip content={t("detail.openDestination")}>
              <a
                href={qr.url}
                target="_blank"
                rel="noreferrer noopener"
                aria-label={t("detail.openDestination")}
                className={buttonVariants({
                  variant: "ghost",
                  size: "icon-sm",
                })}
              >
                <ExternalLink aria-hidden />
              </a>
            </Tooltip>
          </div>
        </div>
        <dl className="flex flex-wrap items-center gap-x-6 gap-y-1.5 text-small">
          <div className="flex items-baseline gap-1.5">
            <dt className="text-fg-muted">{t("detail.created")}</dt>
            <dd className="font-mono tabular-nums">
              {formatDate(new Date(qr.createdAt), intlLocale)}
            </dd>
          </div>
          <div className="flex items-baseline gap-1.5">
            <dt className="text-fg-muted">{t("detail.code")}</dt>
            <dd className="font-mono">{qr.publicId || qr.key}</dd>
          </div>
          {qr.attachedLinkKey ? (
            <div className="flex items-baseline gap-1.5">
              <dt className="text-fg-muted">{t("detail.attached")}</dt>
              <dd className="font-mono">{qr.attachedLinkKey}</dd>
            </div>
          ) : null}
          {qr.tags.length ? (
            <div className="flex min-w-0 items-center gap-1.5">
              <dt className="sr-only">{t("detail.tags")}</dt>
              <dd className="min-w-0">
                <TagChips tags={qr.tags.map((tag) => tag.name)} max={6} />
              </dd>
            </div>
          ) : null}
        </dl>
      </div>
      <div className="flex items-center gap-2">
        <QrDownloadMenu options={options} name={qr.publicId || qr.key} />
        {canEdit ? (
          <Link
            href={`/${workspace}/qr/${qr.id}/edit`}
            className={buttonVariants({ variant: "primary" })}
          >
            <Pencil aria-hidden />
            {t("actions.edit")}
          </Link>
        ) : null}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon-md"
              aria-label={t("actions.label", { title: qr.title || qr.key })}
            >
              <Ellipsis aria-hidden />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem
              icon={<Trash aria-hidden />}
              tone="danger"
              disabled={!canEdit}
              onSelect={() => setConfirming(true)}
            >
              {t("actions.delete")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={t("delete.title", { count: 1 })}
        description={t("delete.body")}
        confirmLabel={t("delete.confirm", { count: 1 })}
        onConfirm={confirmDelete}
      />
    </section>
  );
}
