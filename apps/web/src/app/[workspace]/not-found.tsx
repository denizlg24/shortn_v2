"use client";

import { buttonVariants, EmptyState } from "@shortn/ui";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { sectionHref } from "@/components/shell/nav";
import { PageHeader } from "@/components/shell/page-header";
import { useShell } from "@/components/shell/shell-context";

// Something inside a workspace the user can open (a deleted link, a mistyped
// section). A workspace that doesn't exist or isn't shared lands on the root
// not-found, because the workspace layout is what rejects it.
export default function WorkspaceNotFound() {
  const t = useTranslations("notFound.workspace");
  const { workspace } = useShell();
  return (
    <>
      <PageHeader title={t("header")} />
      <EmptyState
        title={t("title", { workspace: workspace.name })}
        description={t("body")}
        action={
          <Link
            href={sectionHref(workspace.slug, "links")}
            className={buttonVariants()}
          >
            {t("action")}
          </Link>
        }
      />
    </>
  );
}
