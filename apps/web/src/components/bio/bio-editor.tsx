"use client";

import type { BioEditable } from "@shortn/core";
import {
  announce,
  Button,
  buttonVariants,
  cn,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@shortn/ui";
import { Ellipsis, ExternalLink, Lock, Trash } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  deleteBioPageAction,
  setBioLinksAction,
  updateBioPageAction,
} from "@/server/actions/bio";
import { Segmented } from "../analytics/segmented";
import { settle, type ActionError } from "../editor/action-error";
import { CopyButton } from "../editor/copy-button";
import { ConfirmDialog } from "../settings/confirm-dialog";
import { BreadcrumbTitle } from "../shell/breadcrumb-title";
import { PageHeader } from "../shell/page-header";
import { BioAppearanceSection } from "./bio-appearance-section";
import {
  appearanceOf,
  appearanceProblem,
  badLinkImage,
  badSocial,
  linksInput,
  linksOf,
  profileOf,
  profilePatch,
  profileProblem,
  sameAppearance,
  sameLinks,
  sameProfile,
  sameSocials,
  socialsInput,
  socialsOf,
  themeOf,
  type AppearanceDraft,
  type LinkItem,
  type ProfileDraft,
  type SocialItem,
} from "./bio-draft";
import { useBioError } from "./bio-errors";
import { BioLinksSection } from "./bio-links-section";
import { BioPreview } from "./bio-preview";
import { BioProfileSection } from "./bio-profile-section";
import { publicPath, withScheme } from "./bio-rules";
import { idleSave, type SaveState } from "./bio-section";
import { BioSocialsSection } from "./bio-socials-section";

type SectionKey = "profile" | "links" | "socials" | "appearance";

interface Drafts {
  profile: ProfileDraft;
  links: LinkItem[];
  socials: SocialItem[];
  appearance: AppearanceDraft;
}

const draftsOf = (bio: BioEditable): Drafts => ({
  profile: profileOf(bio),
  links: linksOf(bio),
  socials: socialsOf(bio),
  appearance: appearanceOf(bio),
});

const idle: Record<SectionKey, SaveState> = {
  profile: idleSave,
  links: idleSave,
  socials: idleSave,
  appearance: idleSave,
};

export function BioEditor({
  workspace,
  bio,
  linkDomain,
  publicOrigin,
  canEdit,
}: {
  workspace: string;
  bio: BioEditable;
  linkDomain: string;
  /** Where legacy serves /b/{slug} until P5, e.g. https://shortn.at. */
  publicOrigin: string;
  canEdit: boolean;
}) {
  const t = useTranslations("bio");
  const router = useRouter();
  const toError = useBioError();
  const [saved, setSaved] = useState(() => draftsOf(bio));
  const [drafts, setDrafts] = useState(saved);
  const [status, setStatus] = useState(idle);
  const [mobileView, setMobileView] = useState<"edit" | "preview">("edit");
  const [confirming, setConfirming] = useState(false);

  const dirty: Record<SectionKey, boolean> = {
    profile: !sameProfile(saved.profile, drafts.profile),
    links: !sameLinks(saved.links, drafts.links),
    socials: !sameSocials(saved.socials, drafts.socials),
    appearance: !sameAppearance(saved.appearance, drafts.appearance),
  };
  const anyDirty = Object.values(dirty).some(Boolean);

  useEffect(() => {
    if (!anyDirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [anyDirty]);

  const url = `${publicOrigin}${publicPath(bio.slug)}`;
  const displayUrl = url.replace(/^https?:\/\//, "");
  const viewerReason = canEdit ? null : t("viewerReason");

  const edit = <K extends SectionKey>(key: K, value: Drafts[K]) => {
    setDrafts((current) => ({ ...current, [key]: value }));
    setStatus((current) => ({ ...current, [key]: idleSave }));
  };

  const sectionName = (key: SectionKey) => {
    switch (key) {
      case "profile":
        return t("profile.title");
      case "links":
        return t("links.title");
      case "socials":
        return t("socials.title");
      case "appearance":
        return t("appearance.title");
    }
  };

  const setSection = (key: SectionKey, state: SaveState) =>
    setStatus((current) => ({ ...current, [key]: state }));

  const fail = (key: SectionKey, error: ActionError<string>) =>
    setSection(key, { pending: false, saved: false, error });

  /** Runs one section's save and, on success, makes `next` its new baseline. */
  const run = async <K extends SectionKey>(
    key: K,
    action: () => ReturnType<typeof updateBioPageAction>,
    next: Drafts[K],
  ) => {
    setSection(key, { pending: true, saved: false, error: null });
    const result = await settle(action());
    if (!result.ok) {
      fail(key, toError(result));
      return;
    }
    setSaved((current) => ({ ...current, [key]: next }));
    setDrafts((current) => ({ ...current, [key]: next }));
    setSection(key, { pending: false, saved: true, error: null });
    announce(t("savedSection", { section: sectionName(key) }));
  };

  const saveProfile = () => {
    const problem = profileProblem(drafts.profile);
    if (problem) {
      fail("profile", {
        field: "form",
        message: t(`profile.errors.${problem}`),
      });
      return;
    }
    const patch = profilePatch(saved.profile, drafts.profile);
    const next: ProfileDraft = {
      title: drafts.profile.title.trim(),
      description: drafts.profile.description.trim(),
      avatarUrl: drafts.profile.avatarUrl.trim(),
      avatarShape: drafts.profile.avatarShape,
    };
    void run(
      "profile",
      () => updateBioPageAction(workspace, bio.id, patch),
      next,
    );
  };

  const saveLinks = () => {
    const bad = badLinkImage(drafts.links);
    if (bad >= 0) {
      fail("links", {
        field: `link-${bad}`,
        message: t("links.errors.image", { position: bad + 1 }),
      });
      return;
    }
    const input = linksInput(drafts.links);
    const next = drafts.links.map((item, at) => ({
      ...item,
      title: input[at]?.title ?? item.title,
      image: item.image.trim(),
    }));
    void run("links", () => setBioLinksAction(workspace, bio.id, input), next);
  };

  const saveSocials = () => {
    const bad = badSocial(drafts.socials);
    if (bad >= 0) {
      fail("socials", {
        field: `social-${bad}`,
        message: t("socials.errors.url", { position: bad + 1 }),
      });
      return;
    }
    const next = drafts.socials.map((item) => ({
      ...item,
      url: withScheme(item.url),
    }));
    void run(
      "socials",
      () =>
        updateBioPageAction(workspace, bio.id, {
          socials: socialsInput(drafts.socials),
        }),
      next,
    );
  };

  const saveAppearance = () => {
    const problem = appearanceProblem(drafts.appearance);
    if (problem) {
      fail("appearance", {
        field: problem,
        message: t(`appearance.errors.${problem}`),
      });
      return;
    }
    void run(
      "appearance",
      () =>
        updateBioPageAction(workspace, bio.id, {
          theme: themeOf(drafts.appearance),
          socialColor: drafts.appearance.socialColor.trim() || "original",
        }),
      drafts.appearance,
    );
  };

  const confirmDelete = async (): Promise<string | null> => {
    const result = await settle(deleteBioPageAction(workspace, bio.id));
    if (!result.ok) return toError(result).message;
    announce(t("delete.done", { slug: bio.slug }));
    router.replace(`/${workspace}/bio`);
    return null;
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PageHeader
        title={
          <BreadcrumbTitle
            trail={[{ href: `/${workspace}/bio`, label: t("title") }]}
          >
            {saved.profile.title || bio.slug}
          </BreadcrumbTitle>
        }
        className="flex-wrap gap-y-2 py-2.5"
      >
        <div className="ml-auto flex min-w-0 items-center gap-1">
          <span className="truncate font-mono text-small text-fg-muted max-md:hidden">
            {displayUrl}
          </span>
          <CopyButton text={url} label={t("copyUrl")} />
          <a
            href={url}
            target="_blank"
            rel="noreferrer noopener"
            aria-label={t("openPage")}
            title={t("openPage")}
            className={buttonVariants({ variant: "ghost", size: "icon-sm" })}
          >
            <ExternalLink aria-hidden />
          </a>
          {canEdit ? null : (
            <span className="ml-2 inline-flex items-center gap-1.5 text-small whitespace-nowrap text-fg-muted">
              <Lock aria-hidden className="size-3.5" />
              {t("viewOnly")}
            </span>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={t("actions.label", { slug: bio.slug })}
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
        <Segmented
          label={t("mobileView.label")}
          value={mobileView}
          onValueChange={setMobileView}
          options={[
            { value: "edit", label: t("mobileView.edit") },
            { value: "preview", label: t("mobileView.preview") },
          ]}
          className="lg:hidden max-sm:order-last max-sm:w-full max-sm:[&>button]:flex-1 max-sm:[&>button]:justify-center"
        />
      </PageHeader>

      <div className="flex min-h-0 flex-1 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(420px,40%)]">
        <div
          className={cn(
            "min-h-0 flex-1 overflow-y-auto pb-10",
            mobileView === "preview" && "max-lg:hidden",
          )}
        >
          <BioProfileSection
            draft={drafts.profile}
            onChange={(value) => edit("profile", value)}
            dirty={dirty.profile}
            state={status.profile}
            viewerReason={viewerReason}
            onSave={saveProfile}
          />
          <BioLinksSection
            workspace={workspace}
            linkDomain={linkDomain}
            items={drafts.links}
            onChange={(value) => edit("links", value)}
            dirty={dirty.links}
            state={status.links}
            viewerReason={viewerReason}
            onSave={saveLinks}
          />
          <BioSocialsSection
            items={drafts.socials}
            onChange={(value) => edit("socials", value)}
            dirty={dirty.socials}
            state={status.socials}
            viewerReason={viewerReason}
            onSave={saveSocials}
          />
          <BioAppearanceSection
            draft={drafts.appearance}
            onChange={(value) => edit("appearance", value)}
            dirty={dirty.appearance}
            state={status.appearance}
            viewerReason={viewerReason}
            onSave={saveAppearance}
          />
        </div>

        <aside
          aria-label={t("preview.label")}
          className={cn(
            "flex min-h-0 flex-1 flex-col items-center gap-3 overflow-y-auto border-line bg-bg-subtle px-gutter py-6 lg:border-l",
            mobileView === "edit" && "max-lg:hidden",
          )}
        >
          <div
            className="w-[360px] max-w-full shrink-0 overflow-hidden rounded-[28px] border border-line-strong"
            style={{ height: "min(720px, calc(100dvh - 180px))" }}
          >
            <div
              tabIndex={0}
              aria-label={t("preview.frame")}
              className="size-full overflow-y-auto [scrollbar-width:thin] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-signal"
            >
              <div inert className="min-h-full">
                <BioPreview
                  profile={drafts.profile}
                  links={drafts.links}
                  socials={drafts.socials}
                  appearance={drafts.appearance}
                />
              </div>
            </div>
          </div>
          <p className="max-w-[360px] text-center text-meta text-pretty text-fg-muted">
            {anyDirty
              ? t("preview.unsaved")
              : t("preview.live", { url: displayUrl })}
          </p>
        </aside>
      </div>

      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={t("delete.title", { slug: bio.slug })}
        description={t("delete.body", { url: displayUrl })}
        confirmLabel={t("delete.confirm")}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
