import { RegisterForm } from "@/components/register/register-form";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { use } from "react";

export async function generateMetadata() {
  const t = await getTranslations("metadata");

  return {
    title: t("register.title"),
    description: t("register.description"),
    keywords: t("register.keywords")
      .split(",")
      .map((k) => k.trim()),
    openGraph: {
      title: t("register.title"),
      description: t("register.description"),
      type: "website",
      siteName: "Shortn",
    },
    twitter: {
      card: "summary_large_image",
      title: t("register.title"),
      description: t("register.description"),
    },
  };
}

export default function Home({
  params,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  params: any;
}) {
  const { locale } = use<{ locale: string }>(params);
  setRequestLocale(locale);
  return (
    <main className="flex flex-col items-center w-full mx-auto md:gap-0 gap-2 mb-16">
      <div className="w-full flex flex-col max-w-lg px-4 py-6 gap-6 sm:pt-16">
        <RegisterForm />
      </div>
    </main>
  );
}
