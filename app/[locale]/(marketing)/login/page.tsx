import { LoginForm } from "@/components/login/login-form";
import { MarketingPage } from "@/components/marketing/marketing-primitives";
import { Check } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";

export async function generateMetadata() {
  const t = await getTranslations("metadata");

  return {
    title: t("login.title"),
    description: t("login.description"),
    keywords: t("login.keywords")
      .split(",")
      .map((k) => k.trim()),
    openGraph: {
      title: t("login.title"),
      description: t("login.description"),
      type: "website",
      siteName: "Shortn",
    },
    twitter: {
      card: "summary_large_image",
      title: t("login.title"),
      description: t("login.description"),
    },
  };
}

export default async function Home({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const tHome = await getTranslations("homepage");

  return (
    <MarketingPage className="max-w-6xl">
      <section className="grid gap-12 border-b border-primary/10 pb-12 pt-6 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,0.9fr)] lg:items-start lg:gap-16">
        <div className="space-y-8">
          <p className="text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
            {tHome("badge")}
          </p>
          <h1 className="font-[family-name:var(--font-editorial)] text-5xl leading-none tracking-[-0.05em] text-balance sm:text-6xl lg:text-7xl">
            {tHome("hero-title")}
          </h1>
          <p className="max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
            {tHome("hero-subtitle")}
          </p>
          <div className="space-y-3 border-t border-primary/10 pt-5">
            {[
              tHome("no-credit-card"),
              tHome("no-onboarding"),
              tHome("free-forever"),
            ].map((item) => (
              <div key={item} className="flex items-start gap-3 text-sm">
                <Check className="mt-0.5 h-4 w-4 text-primary/75" />
                <span className="text-muted-foreground">{item}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="border-t border-primary/10 pt-5 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0">
          <div className="mx-auto flex w-full max-w-lg flex-col gap-6">
            <LoginForm />
          </div>
        </div>
      </section>
    </MarketingPage>
  );
}
