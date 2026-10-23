"use client";

import {
  Button,
  Dialog,
  DialogCloseButton,
  DialogContent,
  DialogFooter,
  DialogHeader,
} from "@shortn/ui";
import {
  ArrowDownUp,
  Braces,
  ImagePlus,
  Link2,
  MessageSquare,
  Palette,
  PanelsTopLeft,
  QrCode,
  SquareUser,
  type LucideIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  latestEntry,
  type ChangelogHighlightId,
} from "@/lib/changelog/entries";
import { shouldAutoOpen } from "@/lib/changelog/seen";
import { useChangelogSeen } from "@/lib/changelog/use-changelog-seen";
import { useShell } from "../shell/shell-context";
import { useTour } from "../tour/tour-provider";

const icons: Record<ChangelogHighlightId, LucideIcon> = {
  bioNewest: ArrowDownUp,
  bioStyles: Palette,
  bioOrder: ArrowDownUp,
  bioImages: ImagePlus,
  feedback: MessageSquare,
  dashboard: PanelsTopLeft,
  links: Link2,
  qr: QrCode,
  bio: SquareUser,
  developers: Braces,
};

// Let the page settle before covering it.
const openDelay = 600;

// A failed storage write must not reopen the dialog on every navigation.
let dismissedThisSession = false;

/**
 * The one dialog the dashboard opens by itself: the latest release, once per
 * browser, with a way into the tour.
 */
export function WhatsNewDialog({ impersonating }: { impersonating: boolean }) {
  const t = useTranslations("changelog");
  const { workspace } = useShell();
  const { status, markSeen } = useChangelogSeen();
  const tour = useTour();
  const [open, setOpen] = useState(false);
  const startTour = useRef(false);
  const primary = useRef<HTMLButtonElement>(null);
  // Opened by itself, so there is no trigger for focus to return to.
  const returnFocus = useRef<HTMLElement | null>(null);
  const tourActive = tour.progress.status === "active";

  useEffect(() => {
    if (
      dismissedThisSession ||
      !shouldAutoOpen({ status, impersonating, tourActive })
    )
      return;
    const timer = setTimeout(() => {
      returnFocus.current =
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null;
      setOpen(true);
    }, openDelay);
    return () => clearTimeout(timer);
  }, [status, impersonating, tourActive]);

  const close = () => {
    dismissedThisSession = true;
    markSeen();
    setOpen(false);
  };
  const entry = `entries.${latestEntry.id}` as const;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) close();
      }}
    >
      <DialogContent
        className="top-1/2 max-h-[calc(100dvh-2rem)] max-w-[30rem] -translate-y-1/2 gap-5 overflow-y-auto p-6 max-sm:p-5"
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          primary.current?.focus();
        }}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          // The tour moves focus into its own popover.
          if (startTour.current) return;
          const previous = returnFocus.current;
          if (previous?.isConnected) previous.focus();
          else document.getElementById("main")?.focus();
        }}
      >
        <DialogHeader
          title={t(`${entry}.title`)}
          description={t(`${entry}.summary`)}
        />
        <ul className="flex flex-col gap-4 border-t border-line pt-5">
          {latestEntry.highlights.map((id) => {
            const Icon = icons[id];
            return (
              <li
                key={id}
                className="grid grid-cols-[1rem_minmax(0,1fr)] gap-3"
              >
                <Icon aria-hidden className="mt-0.5 size-4 text-fg-subtle" />
                <div className="min-w-0">
                  <p className="text-small font-medium text-pretty text-fg">
                    {t(`${entry}.highlights.${id}.title`)}
                  </p>
                  <p className="mt-0.5 text-small text-pretty text-fg-muted">
                    {t(`${entry}.highlights.${id}.body`)}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
        <DialogFooter className="mt-0 justify-between gap-3 border-t border-line pt-4 max-sm:flex-col-reverse max-sm:items-stretch">
          <Link
            href={`/${workspace.slug}/changelog`}
            onClick={close}
            className="rounded-chip text-small font-medium text-signal underline-offset-4 hover:underline max-sm:self-center"
          >
            {t("dialog.seeAll")}
          </Link>
          <div className="flex gap-2 max-sm:flex-col-reverse max-sm:items-stretch">
            <Button variant="ghost" onClick={close}>
              {t("dialog.later")}
            </Button>
            <Button
              ref={primary}
              variant="primary"
              onClick={() => {
                startTour.current = true;
                close();
                tour.start();
              }}
            >
              {t("dialog.takeTour")}
            </Button>
          </div>
        </DialogFooter>
        <DialogCloseButton />
      </DialogContent>
    </Dialog>
  );
}
