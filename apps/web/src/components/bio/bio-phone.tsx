"use client";

import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import type {
  AppearanceDraft,
  LinkItem,
  ProfileDraft,
  SocialItem,
} from "./bio-draft";
import { BioPreview } from "./bio-preview";

export interface BioDrafts {
  profile: ProfileDraft;
  links: LinkItem[];
  socials: SocialItem[];
  appearance: AppearanceDraft;
}

/** The public page in a phone-sized frame, drawn from the given drafts. */
export function BioPhone({
  drafts,
  caption,
}: {
  drafts: BioDrafts;
  caption: ReactNode;
}) {
  const t = useTranslations("bio.preview");
  return (
    <aside aria-label={t("label")} className="flex flex-col items-center gap-3">
      <div
        className="w-[360px] max-w-full shrink-0 overflow-hidden rounded-[28px] border border-line-strong"
        style={{ height: "min(680px, calc(100dvh - 160px))" }}
      >
        <div
          tabIndex={0}
          aria-label={t("frame")}
          className="size-full overflow-y-auto [scrollbar-width:thin] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-signal"
        >
          <div inert className="grid min-h-full">
            <BioPreview
              profile={drafts.profile}
              links={drafts.links}
              socials={drafts.socials}
              appearance={drafts.appearance}
            />
          </div>
        </div>
      </div>
      <p className="max-w-[360px] text-center text-small text-pretty text-fg-muted">
        {caption}
      </p>
    </aside>
  );
}

/** A tab's form beside the phone; the phone stays in view on wide screens. */
export function BioSplit({
  children,
  preview,
}: {
  children: ReactNode;
  preview: ReactNode;
}) {
  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_380px]">
      <div className="min-w-0 max-w-[640px]">{children}</div>
      <div className="lg:sticky lg:top-17 lg:self-start">{preview}</div>
    </div>
  );
}
