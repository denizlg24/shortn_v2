import { can } from "@shortn/core/authz";
import { buttonVariants } from "@shortn/ui";
import { getFormatter, getTranslations } from "next-intl/server";
import Link from "next/link";
import type { ReactNode } from "react";
import {
  appearanceOf,
  linksOf,
  profileOf,
  socialsOf,
} from "@/components/bio/bio-draft";
import { BioPhone, BioSplit } from "@/components/bio/bio-phone";
import { CopyButton } from "@/components/page/copy-button";
import { ShareButton } from "@/components/page/share-button";
import { Notice } from "@/components/page/notice";
import { Page, Section } from "@/components/page/page";
import { bioPublicUrl, bioTabs, loadBio } from "@/server/bio-page";

const savedTabs = ["profile", "links", "socials", "appearance"] as const;

export async function generateMetadata({
  params,
}: PageProps<"/[workspace]/bio/[id]">) {
  const { workspace, id } = await params;
  const { bio } = await loadBio(workspace, id);
  return { title: bio.title || bio.slug };
}

export default async function BioOverviewPage({
  params,
  searchParams,
}: PageProps<"/[workspace]/bio/[id]">) {
  const { workspace, id } = await params;
  const { created, saved } = await searchParams;
  const t = await getTranslations("bio");
  const format = await getFormatter();
  const { ctx, bio } = await loadBio(workspace, id);
  const base = `/${workspace}/bio/${id}`;
  const editable = can(ctx.actor, "resource.update");
  const url = bioPublicUrl(bio.slug);
  const shown = url.replace(/^https?:\/\//, "");
  const savedTab = savedTabs.find((tab) => tab === saved);

  const detail = (label: string, value: ReactNode, edit?: string) => (
    <div className="grid grid-cols-[8rem_1fr_auto] items-baseline gap-4 py-2.5 max-sm:grid-cols-[1fr_auto] max-sm:gap-1">
      <dt className="text-small text-fg-muted max-sm:col-span-2">{label}</dt>
      <dd className="min-w-0 text-small break-words">{value}</dd>
      {edit && editable ? (
        <dd>
          <Link
            href={`${base}/${edit}`}
            className="text-small text-signal hover:underline"
          >
            {t("overview.edit")}
          </Link>
        </dd>
      ) : (
        <dd />
      )}
    </div>
  );

  return (
    <Page
      crumbs={[
        { label: t("list.title"), href: `/${workspace}/bio` },
        { label: bio.title || bio.slug },
      ]}
      title={bio.title || bio.slug}
      description={shown}
      actions={
        <>
          <CopyButton
            value={url}
            label={t("overview.copy")}
            copiedLabel={t("overview.copied")}
          />
          <ShareButton url={url} title={bio.title || bio.slug} />
          <a
            href={url}
            target="_blank"
            rel="noreferrer noopener"
            className={buttonVariants({ variant: "ghost", size: "md" })}
          >
            {t("overview.open")}
          </a>
        </>
      }
      tabs={bioTabs(workspace, id, editable, (key) => t(`tabs.${key}`))}
      tabsLabel={t("tabs.label")}
    >
      {created ? <Notice tone="success">{t("overview.created")}</Notice> : null}
      {savedTab ? (
        <Notice tone="success">{t(`overview.saved.${savedTab}`)}</Notice>
      ) : null}
      <BioSplit
        preview={
          <BioPhone
            drafts={{
              profile: profileOf(bio),
              links: linksOf(bio),
              socials: socialsOf(bio),
              appearance: appearanceOf(bio),
            }}
            caption={t("preview.live", { url: shown })}
          />
        }
      >
        <Section title={t("overview.details")}>
          <dl className="divide-y divide-line border-y border-line">
            {detail(
              t("overview.url"),
              <a
                href={url}
                target="_blank"
                rel="noreferrer noopener"
                className="font-mono text-signal hover:underline"
              >
                {shown}
              </a>,
            )}
            {detail(t("overview.title"), bio.title || bio.slug, "profile")}
            {detail(
              t("overview.description"),
              bio.description || t("overview.none"),
              "profile",
            )}
            {detail(
              t("overview.links"),
              t("overview.linkCount", { count: bio.links.length }),
              "links",
            )}
            {detail(
              t("overview.socials"),
              t("overview.socialCount", { count: bio.socials.length }),
              "socials",
            )}
            {detail(
              t("overview.updated"),
              format.dateTime(new Date(bio.updatedAt), {
                dateStyle: "long",
                timeStyle: "short",
              }),
            )}
          </dl>
        </Section>
        {can(ctx.actor, "resource.delete", {
          createdBy: bio.createdBy ?? undefined,
        }) ? (
          <Section
            title={t("overview.delete")}
            description={t("overview.deleteHint")}
          >
            <Link
              href={`${base}/delete`}
              className={buttonVariants({ variant: "dangerGhost", size: "md" })}
            >
              {t("overview.delete")}
            </Link>
          </Section>
        ) : null}
      </BioSplit>
    </Page>
  );
}
