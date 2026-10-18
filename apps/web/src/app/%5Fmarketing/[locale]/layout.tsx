import { notFound } from "next/navigation";
import { preconnect } from "react-dom";
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
  // On the root host, CSS, fonts and scripts come from the web origin.
  if (process.env.WEB_ASSET_ORIGIN)
    preconnect(process.env.WEB_ASSET_ORIGIN, { crossOrigin: "anonymous" });
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
