"use client";
import { useTranslations } from "next-intl";
import { migratedBioContent } from "@shortn/core/bio-content";
import type {
  AppearanceDraft,
  LinkItem,
  ProfileDraft,
  SocialItem,
} from "./bio-draft";
import { BioRenderer } from "./public/bio-renderer";
import { themeOf } from "./bio-draft";
import "./public/fonts.css";

/** The same renderer used by the public route, driven by unsaved editor fields. */
export function BioPreview({
  profile,
  links,
  socials,
  appearance,
}: {
  profile: ProfileDraft;
  links: LinkItem[];
  socials: SocialItem[];
  appearance: AppearanceDraft;
}) {
  const t = useTranslations("bio.public");
  const content = migratedBioContent({
    title: profile.title,
    description: profile.description,
    avatarUrl: profile.avatarUrl,
    avatarShape: profile.avatarShape,
    theme: themeOf(appearance),
    socials,
    links: links.map((link) => ({
      link: link.linkId,
      title: link.title,
      image: link.image,
    })),
  });
  return (
    <BioRenderer
      content={content}
      links={Object.fromEntries(
        links.map((link) => [
          link.linkId,
          {
            href: `https://shortn.at/${encodeURIComponent(link.key)}`,
            title: link.title || link.key,
          },
        ]),
      )}
      preview
      labels={{
        branding: t("branding"),
        loadEmbed: t.raw("loadEmbed"),
        embedConsent: t.raw("embedConsent"),
        unavailable: t("unavailable"),
      }}
    />
  );
}
