import { notFound } from "next/navigation";
import { displayFace } from "@/components/marketing/fonts/display";
import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";
import { appHref, currentMarketingPath, toLocale } from "@/server/marketing";

export default async function MarketingLayout({
  params,
  children,
}: LayoutProps<"/_marketing/[locale]">) {
  const locale = toLocale((await params).locale);
  if (!locale) notFound();
  const current = await currentMarketingPath();
  return (
    <div className={`${displayFace.variable} flex min-h-dvh flex-col`}>
      <SiteHeader
        locale={locale}
        current={current}
        signInHref={appHref("/login")}
        registerHref={appHref("/register")}
      />
      <main id="content" className="flex flex-1 flex-col">
        {children}
      </main>
      <SiteFooter locale={locale} current={current} />
    </div>
  );
}
