"use client";

import type { LinkView } from "@shortn/core";
import {
  Button,
  Destination,
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  ShortLink,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Tooltip,
} from "@shortn/ui";
import { ExternalLink } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import type { PlanFeatures } from "@/lib/plan-features";
import { canDeleteLink, canWrite, type Viewer } from "./access";
import type { FormError } from "./form-error";
import { draftFromLink, type LinkDraft } from "./link-draft";
import { LinkForm } from "./link-form";
import { LinkOverview } from "./link-overview";

export const sheetTabs = ["overview", "edit", "qr"] as const;
export type SheetTab = (typeof sheetTabs)[number];

export type SheetMode =
  | {
      kind: "link";
      link: LinkView;
      tab: SheetTab;
      /** Shown once in the edit form, e.g. a UTM save that failed after create. */
      error?: FormError | null;
    }
  | { kind: "create"; draft: LinkDraft };

const tabPanel =
  "min-h-0 flex-1 data-[state=active]:flex data-[state=active]:flex-col";

interface LinkSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: SheetMode | null;
  onTabChange: (tab: SheetTab) => void;
  workspace: string;
  domain: string;
  viewer: Viewer;
  features: PlanFeatures;
  allTags: string[];
  onCreate: (draft: LinkDraft) => Promise<FormError | null>;
  onSave: (link: LinkView, draft: LinkDraft) => Promise<FormError | null>;
  onDelete: (link: LinkView) => void;
}

export function LinkSheet({
  open,
  onOpenChange,
  mode,
  onTabChange,
  workspace,
  domain,
  viewer,
  features,
  allTags,
  onCreate,
  onSave,
  onDelete,
}: LinkSheetProps) {
  const t = useTranslations("links");
  const canEdit = canWrite(viewer);
  const breakdownGate = features.analyticsBreakdowns.allowed
    ? null
    : features.analyticsBreakdowns.plan;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        {...(mode?.kind === "create" ? { "aria-describedby": undefined } : {})}
      >
        {mode?.kind === "create" ? (
          <>
            <SheetHeader>
              <SheetTitle>{t("composer.label")}</SheetTitle>
            </SheetHeader>
            <LinkForm
              key="create"
              mode="create"
              initial={mode.draft}
              protection={null}
              domain={domain}
              canEdit={canEdit}
              features={features}
              allTags={allTags}
              onCancel={() => onOpenChange(false)}
              onSubmit={onCreate}
            />
          </>
        ) : mode?.kind === "link" ? (
          <>
            <SheetHeader>
              <SheetTitle className="sr-only">{`${mode.link.domain}/${mode.link.key}`}</SheetTitle>
              <ShortLink
                domain={mode.link.domain}
                linkKey={mode.link.key}
                size="lg"
                className="max-w-full self-start"
              />
              <SheetDescription asChild>
                <div className="flex min-w-0 items-center gap-1">
                  <Destination url={mode.link.url} className="min-w-0 flex-1" />
                  <Tooltip content={t("sheet.openDestination")}>
                    <a
                      href={mode.link.url}
                      target="_blank"
                      rel="noreferrer noopener"
                      aria-label={t("sheet.openDestination")}
                      className="grid size-7 shrink-0 place-items-center rounded-control text-fg-subtle hover:bg-bg-muted hover:text-fg"
                    >
                      <ExternalLink aria-hidden className="size-4" />
                    </a>
                  </Tooltip>
                </div>
              </SheetDescription>
            </SheetHeader>
            <Tabs
              value={mode.tab}
              onValueChange={(value) => {
                const tab = sheetTabs.find((option) => option === value);
                if (tab) onTabChange(tab);
              }}
              className="flex min-h-0 flex-1 flex-col"
            >
              <TabsList className="px-6 max-md:px-4">
                <TabsTrigger value="overview">
                  {t("sheet.overview")}
                </TabsTrigger>
                <TabsTrigger value="edit">{t("sheet.edit")}</TabsTrigger>
                <TabsTrigger value="qr">{t("sheet.qr")}</TabsTrigger>
              </TabsList>
              <TabsContent value="overview" className={tabPanel}>
                <SheetBody className="pt-5">
                  <LinkOverview
                    key={mode.link.id}
                    workspace={workspace}
                    link={mode.link}
                    breakdownGate={breakdownGate}
                  />
                </SheetBody>
              </TabsContent>
              <TabsContent value="edit" className={tabPanel}>
                <LinkForm
                  key={mode.link.id}
                  mode="edit"
                  initial={draftFromLink(mode.link)}
                  protection={mode.link.password}
                  domain={mode.link.domain}
                  canEdit={canEdit}
                  features={features}
                  allTags={allTags}
                  initialError={mode.error ?? null}
                  onCancel={() => onTabChange("overview")}
                  onSubmit={(draft) => onSave(mode.link, draft)}
                  deleteAction={{
                    allowed: canDeleteLink(viewer, mode.link),
                    onDelete: () => onDelete(mode.link),
                  }}
                />
              </TabsContent>
              <TabsContent value="qr" className={tabPanel}>
                <SheetBody className="pt-6">
                  <QrPanel workspace={workspace} link={mode.link} />
                </SheetBody>
              </TabsContent>
            </Tabs>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

function QrPanel({ workspace, link }: { workspace: string; link: LinkView }) {
  const t = useTranslations("links.qr");
  return (
    <div className="flex max-w-md flex-col items-start gap-4">
      {link.qrCodeId ? (
        <div className="flex flex-col gap-1">
          <p className="text-small text-pretty">{t("attached")}</p>
          <p className="font-mono text-meta break-all text-fg-muted">
            {link.qrCodeId}
          </p>
        </div>
      ) : (
        <p className="text-small text-pretty text-fg-muted">{t("none")}</p>
      )}
      <Button asChild>
        <Link href={`/${workspace}/qr` as const}>{t("open")}</Link>
      </Button>
    </div>
  );
}
