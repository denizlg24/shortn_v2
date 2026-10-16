import { ownedBy, totals } from "@shortn/core";
import { can } from "@shortn/core/authz";
import { collection, type Documents } from "@shortn/db";
import { buttonVariants } from "@shortn/ui";
import { getFormatter, getTranslations } from "next-intl/server";
import Link from "next/link";
import type { ReactNode } from "react";
import { CopyButton } from "@/components/page/copy-button";
import { Notice } from "@/components/page/notice";
import { Page, Section } from "@/components/page/page";
import { QrDownloads } from "@/components/qr/qr-downloads";
import { env } from "@/server/env";
import { QrImage } from "@/components/qr/qr-image";
import { printedOptions, printedSize } from "@/components/qr/qr-options";
import { loadQr, qrName, qrTabs } from "@/server/qr-page";
import { lastDays } from "@/server/time";

type LinkDoc = Documents["links"];

export async function generateMetadata({
  params,
}: PageProps<"/[workspace]/qr/[id]">) {
  const { workspace, id } = await params;
  const { qr } = await loadQr(workspace, id);
  return { title: qrName(qr) };
}

export default async function QrOverviewPage({
  params,
  searchParams,
}: PageProps<"/[workspace]/qr/[id]">) {
  const { workspace, id } = await params;
  const { created, saved } = await searchParams;
  const t = await getTranslations("qr");
  const format = await getFormatter();
  const { ctx, qr } = await loadQr(workspace, id);
  const base = `/${workspace}/qr/${id}`;
  const editable = can(ctx.actor, "resource.update");
  const host = qr.shortUrl.replace(/^https?:\/\//, "");
  const options = printedOptions(qr.storedDesign, qr.shortUrl);
  const size = printedSize(qr.storedDesign);

  // Scans are counted on the code's own (hidden) link; the attached link
  // is the one the user created, shown for navigation.
  const links = collection(ctx.db, "links");
  const [backing, attached] = await Promise.all([
    links.findOne(
      { $and: [{ urlCode: qr.key }, ownedBy<LinkDoc>(ctx.workspace)] },
      { projection: { _id: 1 } },
    ),
    qr.attachedLinkKey
      ? links.findOne(
          {
            $and: [
              { urlCode: qr.attachedLinkKey, isQrCode: { $ne: true } },
              ownedBy<LinkDoc>(ctx.workspace),
            ],
          },
          { projection: { _id: 1 } },
        )
      : null,
  ]);
  const stats = backing
    ? await totals(
        ctx.db,
        {
          workspaceId: ctx.workspace._id,
          linkIds: [backing._id],
          kind: "scan",
        },
        { ...lastDays(30), timezone: "UTC" },
      )
    : { clicks: 0, scans: 0, uniques: 0 };

  const detail = (label: string, value: ReactNode) => (
    <div className="grid grid-cols-[9rem_1fr] gap-4 py-2.5 max-sm:grid-cols-1 max-sm:gap-1">
      <dt className="text-small text-fg-muted">{label}</dt>
      <dd className="min-w-0 text-small break-words">{value}</dd>
    </div>
  );
  const date = (iso: string) =>
    format.dateTime(new Date(iso), { dateStyle: "long", timeStyle: "short" });

  return (
    <Page
      crumbs={[
        { label: t("list.title"), href: `/${workspace}/qr` },
        { label: qrName(qr) },
      ]}
      title={qrName(qr)}
      description={host}
      actions={
        <>
          <CopyButton
            value={qr.shortUrl}
            label={t("overview.copy")}
            copiedLabel={t("overview.copied")}
          />
          {editable ? (
            <Link
              href={`${base}/design`}
              className={buttonVariants({ variant: "primary", size: "lg" })}
            >
              {t("overview.editDesign")}
            </Link>
          ) : null}
        </>
      }
      tabs={qrTabs(workspace, id, editable, (key) => t(`tabs.${key}`))}
      tabsLabel={t("tabs.label")}
    >
      {created ? <Notice tone="success">{t("overview.created")}</Notice> : null}
      {saved ? <Notice tone="success">{t("overview.saved")}</Notice> : null}

      <div className="grid gap-10 lg:grid-cols-[auto_minmax(0,1fr)]">
        <figure className="flex flex-col items-center gap-2 self-start border-y border-line bg-bg-subtle px-6 py-8 lg:border">
          <QrImage
            options={options}
            size={size.width}
            alt={t("preview.alt", { link: host })}
          />
          <figcaption className="font-mono text-meta text-fg-muted tabular-nums">
            {t("preview.size", { width: size.width, height: size.height })}
          </figcaption>
        </figure>

        <div className="min-w-0">
          <Section
            title={t("overview.download")}
            description={t("overview.downloadHint")}
          >
            {env().QR_EXPORTS_ENABLED === "1" ? (
              <>
                <Link
                  href={`${base}/export`}
                  className={buttonVariants({ variant: "primary", size: "md" })}
                >
                  {(await getTranslations("qrExports"))("singleTitle")}
                </Link>
                <details className="mt-4 text-small text-fg-muted">
                  <summary className="w-fit cursor-pointer rounded-control focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal">
                    {(await getTranslations("qrExports"))("jpeg")}
                  </summary>
                  <div className="mt-3">
                    <QrDownloads
                      options={options}
                      name={qr.publicId || qr.key}
                      formats={["jpeg"]}
                    />
                  </div>
                </details>
              </>
            ) : (
              <QrDownloads options={options} name={qr.publicId || qr.key} />
            )}
          </Section>

          <Section
            title={t("overview.last30")}
            aside={
              <Link
                href={`${base}/analytics`}
                className="text-small text-signal hover:underline"
              >
                {t("overview.seeAll")}
              </Link>
            }
          >
            <dl className="grid grid-cols-2 border-y border-line sm:grid-cols-4">
              {(
                [
                  [t("overview.scans"), format.number(stats.scans)],
                  [t("overview.visitors"), format.number(stats.uniques)],
                  [t("overview.allTime"), format.number(qr.scans)],
                  [
                    t("overview.lastScan"),
                    qr.lastScanAt
                      ? format.dateTime(new Date(qr.lastScanAt), {
                          day: "numeric",
                          month: "short",
                        })
                      : t("overview.never"),
                  ],
                ] as const
              ).map(([label, value]) => (
                <div key={label} className="py-3 pr-4">
                  <dt className="text-meta text-fg-muted">{label}</dt>
                  <dd className="mt-1 font-mono text-section tabular-nums">
                    {value}
                  </dd>
                </div>
              ))}
            </dl>
          </Section>

          <Section title={t("overview.details")}>
            <dl className="divide-y divide-line border-y border-line">
              {detail(
                t("overview.destination"),
                <a
                  href={qr.url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="text-signal hover:underline"
                >
                  {qr.url}
                </a>,
              )}
              {detail(
                t("overview.shortLink"),
                <span className="font-mono">{host}</span>,
              )}
              {detail(
                t("overview.code"),
                <span className="font-mono">{qr.publicId || qr.key}</span>,
              )}
              {detail(
                t("overview.attached"),
                qr.attachedLinkKey ? (
                  attached ? (
                    <Link
                      href={`/${workspace}/links/${attached._id.toHexString()}`}
                      className="font-mono text-signal hover:underline"
                    >
                      {qr.attachedLinkKey}
                    </Link>
                  ) : (
                    <span className="font-mono">{qr.attachedLinkKey}</span>
                  )
                ) : (
                  t("overview.none")
                ),
              )}
              {detail(
                t("overview.tags"),
                qr.tags.length
                  ? qr.tags.map((tag) => tag.name).join(", ")
                  : t("overview.none"),
              )}
              {detail(t("overview.createdAt"), date(qr.createdAt))}
            </dl>
          </Section>

          {can(ctx.actor, "resource.delete", {
            createdBy: qr.createdBy ?? undefined,
          }) ? (
            <Section
              title={t("overview.delete")}
              description={t("overview.deleteHint")}
            >
              <Link
                href={`${base}/delete`}
                className={buttonVariants({
                  variant: "dangerGhost",
                  size: "md",
                })}
              >
                {t("overview.delete")}
              </Link>
            </Section>
          ) : null}
        </div>
      </div>
    </Page>
  );
}
