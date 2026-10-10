import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { LinksDesk } from "@/components/links/links-desk";
import {
  getLinkAction,
  listLinksAction,
  listTagsAction,
} from "@/server/actions/links";
import { env } from "@/server/env";
import { planFeatures } from "@/server/plan";
import { requireWorkspace } from "@/server/workspace";

const pageSize = 50;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav");
  return { title: t("links") };
}

export default async function LinksPage({
  params,
  searchParams,
}: PageProps<"/[workspace]/links">) {
  const { workspace: slug } = await params;
  const { link: linkParam, tab } = await searchParams;
  const { actor } = await requireWorkspace(slug);
  const [page, tags, features, opened] = await Promise.all([
    listLinksAction(slug, { limit: pageSize }),
    listTagsAction(slug),
    planFeatures(slug),
    typeof linkParam === "string" ? getLinkAction(slug, linkParam) : null,
  ]);

  return (
    <LinksDesk
      workspace={slug}
      domain={env().LINK_DOMAIN}
      viewer={{ userId: actor.userId, role: actor.role }}
      features={features}
      pageSize={pageSize}
      initialLinks={page.ok ? page.data.links : []}
      initialCursor={page.ok ? page.data.nextCursor : null}
      initialError={!page.ok}
      tags={tags.map((tag) => tag.name)}
      initialLink={
        opened?.ok
          ? {
              link: opened.data,
              tab: tab === "edit" || tab === "qr" ? tab : "overview",
            }
          : null
      }
    />
  );
}
