"use client";

import type { Workspace } from "@shortn/core";
import { Button, EmptyState } from "@shortn/ui";
import { Lock } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { suspensionExemptPath } from "@/lib/workspace-suspension";

type Suspension = NonNullable<Workspace["suspension"]>;

const supportHref = (slug: string) =>
  `mailto:support@shortn.at?subject=${encodeURIComponent(`Workspace review: ${slug}`)}`;

// The layout persists across client navigation, so which pages a suspended
// workspace may open is decided from the live pathname here.
const screened = (suspension: Suspension, pathname: string) =>
  suspension.level === "suspended" && !suspensionExemptPath(pathname);

/** Read-only notice for a locked workspace, and for the pages a suspended
 * workspace can still open (billing, exports). */
export function WorkspaceStatusBanner({
  suspension,
  slug,
}: {
  suspension: Suspension;
  slug: string;
}) {
  const t = useTranslations("shell.suspension");
  if (screened(suspension, usePathname())) return null;
  return (
    <section
      aria-label={t("label")}
      className="flex min-h-9 shrink-0 flex-wrap items-center justify-center gap-x-3 gap-y-1 border-b border-line bg-warning/10 px-gutter py-1 text-small text-fg"
    >
      <p className="flex min-w-0 items-center gap-2">
        <Lock aria-hidden className="size-4 shrink-0 text-warning" />
        <span className="min-w-0 text-pretty">
          {t(
            suspension.level === "locked" ? "lockedNotice" : "suspendedNotice",
            { category: t(`categories.${suspension.category}`) },
          )}
          {suspension.publicNote ? ` ${suspension.publicNote}` : null}
        </span>
      </p>
      <a
        href={supportHref(slug)}
        className="text-small font-medium underline underline-offset-2"
      >
        {t("contact")}
      </a>
    </section>
  );
}

/** Replaces every page of a suspended workspace except billing and exports. */
export function WorkspaceSuspensionGate({
  suspension,
  slug,
  children,
}: {
  suspension: Suspension;
  slug: string;
  children: ReactNode;
}) {
  const t = useTranslations("shell.suspension");
  if (!screened(suspension, usePathname())) return children;
  return (
    <EmptyState
      tone="danger"
      title={t("title")}
      description={
        <>
          {t("body", { category: t(`categories.${suspension.category}`) })}
          {suspension.publicNote ? (
            <span className="mt-2 block">{suspension.publicNote}</span>
          ) : null}
        </>
      }
      action={
        <>
          <Button asChild variant="primary">
            <Link href={`/${slug}/settings/workspace/export`}>
              {t("export")}
            </Link>
          </Button>
          <Button asChild variant="secondary">
            <Link href={`/${slug}/settings/billing`}>{t("billing")}</Link>
          </Button>
        </>
      }
      secondaryAction={
        <Button asChild variant="ghost">
          <a href={supportHref(slug)}>{t("contact")}</a>
        </Button>
      }
    />
  );
}
