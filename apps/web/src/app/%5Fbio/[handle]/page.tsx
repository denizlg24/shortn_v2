import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { BioRenderer } from "@/components/bio/public/bio-renderer";
import { BioViewBeacon } from "@/components/bio/public/view-beacon";
import { loadPublicBio } from "@/server/public-bio";
import { env } from "@/server/env";
import "@/components/bio/public/fonts.css";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ handle: string }>;
}): Promise<Metadata> {
  const bio = await loadPublicBio((await params).handle);
  const profile = bio.content.blocks.find((b) => b.type === "profile");
  const title = bio.content.seo.title || profile?.title || bio.handle;
  const description = bio.content.seo.description || profile?.description || "";
  return {
    title: { absolute: title },
    description,
    ...(bio.content.seo.favicon
      ? {
          icons: {
            icon: [{ url: bio.content.seo.favicon, type: "image/png" }],
            shortcut: bio.content.seo.favicon,
          },
        }
      : {}),
    alternates: { canonical: bio.canonical },
    robots: {
      index: env().BIO_SUBDOMAINS === "1" && !bio.content.seo.noindex,
      follow: true,
    },
    openGraph: {
      title,
      description,
      url: bio.canonical,
      images: [
        new URL(`/_bio/${bio.handle}/opengraph-image`, env().PUBLIC_ORIGIN)
          .href,
      ],
    },
  };
}
export default async function PublicBioPage({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const bio = await loadPublicBio((await params).handle);
  const t = await getTranslations({
    locale: bio.content.locale,
    namespace: "bio.public",
  });
  return (
    <main lang={bio.content.locale} style={{ minHeight: "100dvh" }}>
      <BioRenderer
        now={bio.renderedAt}
        content={bio.content}
        links={bio.links}
        labels={{
          branding: t("branding"),
          loadEmbed: t.raw("loadEmbed"),
          embedConsent: t.raw("embedConsent"),
          unavailable: t("unavailable"),
        }}
      />
      {env().BIO_API_ORIGIN ? (
        <BioViewBeacon
          pageId={bio.id}
          endpoint={`${env().BIO_API_ORIGIN}/v1/bio/view`}
        />
      ) : null}
    </main>
  );
}
