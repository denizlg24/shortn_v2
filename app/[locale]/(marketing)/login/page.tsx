import { LoginForm } from "@/components/login/login-form";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { use } from "react";

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
        <LoginForm />
      </div>
    </main>
  );
}
