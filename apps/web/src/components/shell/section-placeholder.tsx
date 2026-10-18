"use client";

import { Button, EmptyState } from "@shortn/ui";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { sectionHref, type Section } from "./nav";
import { PageHeader } from "./page-header";
import { useShell } from "./shell-context";

export function SectionPlaceholder({ section }: { section: Section }) {
  const t = useTranslations();
  const { workspace } = useShell();
  return (
    <>
      <PageHeader title={t(`nav.${section}`)} />
      <EmptyState
        title={t("placeholder.title")}
        description={t("placeholder.body")}
        action={
          section === "links" ? undefined : (
            <Button asChild>
              <Link href={sectionHref(workspace.slug, "links")}>
                {t("placeholder.back")}
              </Link>
            </Button>
          )
        }
      />
    </>
  );
}
