import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/shell/page-header";
import { SettingsNav } from "@/components/settings/settings-nav";

export default async function SettingsLayout({
  children,
  params,
}: LayoutProps<"/[workspace]/settings">) {
  const { workspace } = await params;
  const t = await getTranslations("settings");
  return (
    <>
      <PageHeader title={t("title")} />
      <div className="flex flex-1 max-md:flex-col md:gap-6 xl:gap-10">
        <SettingsNav slug={workspace} />
        <div className="min-w-0 flex-1 px-gutter pt-8 pb-16 md:pl-0">
          <div className="max-w-3xl">{children}</div>
        </div>
      </div>
    </>
  );
}
