import "server-only";

import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { Page } from "@/components/page/page";

export async function AccountPage({
  workspace,
  title,
  children,
}: {
  workspace: string;
  title: string;
  children: ReactNode;
}) {
  const t = await getTranslations("settings");
  return (
    <Page
      crumbs={[
        { label: t("title"), href: `/${workspace}/settings` },
        { label: t("nav.account"), href: `/${workspace}/settings/account` },
        { label: title },
      ]}
      title={title}
      description={t("account.description")}
      width="form"
    >
      {children}
    </Page>
  );
}
