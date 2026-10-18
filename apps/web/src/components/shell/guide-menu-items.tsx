"use client";

import { cn, DropdownMenuItem } from "@shortn/ui";
import { Compass, Newspaper, RotateCcw } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useChangelogSeen } from "@/lib/changelog/use-changelog-seen";
import { useTour } from "../tour/tour-provider";
import { useShell } from "./shell-context";

/** An unread marker; status dots are the only full circles in the system. */
export function UnseenDot({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-block size-2 shrink-0 rounded-full bg-signal",
        className,
      )}
    />
  );
}

/** What's new and the product tour, in the account and help menus. */
export function GuideMenuItems() {
  const t = useTranslations("tour.menu");
  const tChangelog = useTranslations("changelog");
  const router = useRouter();
  const { workspace, closeDrawer } = useShell();
  const { unseen } = useChangelogSeen();
  const { progress, total, start } = useTour();
  const begin = (step: number) => {
    closeDrawer();
    start(step);
  };
  return (
    <>
      <DropdownMenuItem
        icon={<Newspaper aria-hidden />}
        onSelect={() => {
          closeDrawer();
          router.push(`/${workspace.slug}/changelog`);
        }}
      >
        <span className="flex items-center gap-2">
          {tChangelog("menu")}
          {unseen ? (
            <>
              <UnseenDot />
              <span className="sr-only">{tChangelog("unseen")}</span>
            </>
          ) : null}
        </span>
      </DropdownMenuItem>
      {progress.status === "paused" ? (
        <>
          <DropdownMenuItem
            icon={<Compass aria-hidden />}
            onSelect={() => begin(progress.step)}
          >
            {t("resume", { current: progress.step + 1, total })}
          </DropdownMenuItem>
          <DropdownMenuItem
            icon={<RotateCcw aria-hidden />}
            onSelect={() => begin(0)}
          >
            {t("restart")}
          </DropdownMenuItem>
        </>
      ) : (
        <DropdownMenuItem
          icon={<Compass aria-hidden />}
          onSelect={() => begin(0)}
        >
          {progress.status === "active" ? t("restart") : t("start")}
        </DropdownMenuItem>
      )}
    </>
  );
}
