import { can } from "@shortn/core/authz";
import {
  ownedBioDocument,
  publicBioFromDocument,
  readBioDraft,
} from "@shortn/core";
import { BioRenderer } from "@/components/bio/public/bio-renderer";
import { env } from "@/server/env";
import "@/components/bio/public/fonts.css";
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
  const draft = await readBioDraft(ctx, id);
  const document = await ownedBioDocument(ctx, id);
  const modern =
    env().BIO_DELIVERY_ENABLED === "1" && document && draft
      ? await publicBioFromDocument(
          ctx.db,
          {
            ...document,
            publishedContent: document.publishedContent ?? draft.content,
          },
          env().PUBLIC_ORIGIN,
          env().BIO_SUBDOMAINS === "1",
        )
      : null;
  const modernProfile = modern?.content.blocks.find(
    (block) => block.type === "profile",
  );
  const publicText = await getTranslations("bio.public");
  const base = `/${workspace}/bio/${id}`;
  const editable = can(ctx.actor, "resource.update");
  const url = modern?.canonical ?? bioPublicUrl(bio.slug);
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
          modern ? (
            <div className="mx-auto w-[360px] max-w-full overflow-hidden rounded-[24px] border border-line-strong">
              <BioRenderer
                content={modern.content}
                links={modern.links}
                preview
                labels={{
                  branding: publicText("branding"),
                  loadEmbed: publicText.raw("loadEmbed"),
                  embedConsent: publicText.raw("embedConsent"),
                  unavailable: publicText("unavailable"),
                }}
              />
            </div>
          ) : (
            <BioPhone
              drafts={{
                profile: profileOf(bio),
                links: linksOf(bio),
                socials: socialsOf(bio),
                appearance: appearanceOf(bio),
              }}
              caption={t("preview.live", { url: shown })}
            />
          )
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
            {editable ? (
              <Link
                href={`${base}/editor`}
                className="block py-3 text-small text-signal underline"
              >
                {t("editor.titlePage")}
              </Link>
            ) : null}
            {detail(
              t("overview.title"),
              (modernProfile?.type === "profile"
                ? modernProfile.title
                : bio.title) || bio.slug,
              modern ? "editor" : "profile",
            )}
            {detail(
              t("overview.description"),
              (modernProfile?.type === "profile"
                ? modernProfile.description
                : bio.description) || t("overview.none"),
              modern ? "editor" : "profile",
            )}
            {detail(
              t("overview.links"),
              t("overview.linkCount", {
                count: modern
                  ? modern.content.blocks.reduce(
                      (n, block) =>
                        n +
                        (block.type === "links"
                          ? block.items.length
                          : block.type === "link"
                            ? 1
                            : 0),
                      0,
                    )
                  : bio.links.length,
              }),
              modern ? "editor" : "links",
            )}
            {detail(
              t("overview.socials"),
              t("overview.socialCount", {
                count: modern
                  ? modern.content.blocks.reduce(
                      (count, block) =>
                        count +
                        (block.type === "socials" ? block.items.length : 0),
                      0,
                    )
                  : bio.socials.length,
              }),
              modern ? "editor" : "socials",
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
