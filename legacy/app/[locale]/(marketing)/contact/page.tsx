import {
  MarketingHero,
  MarketingPage,
} from "@/components/marketing/marketing-primitives";
import { ContactForm } from "./contact-form";
import { Facebook, Instagram, Mail, PhoneCall } from "lucide-react";
import { FaXTwitter } from "react-icons/fa6";
import { getTranslations, setRequestLocale } from "next-intl/server";

export async function generateMetadata() {
  const t = await getTranslations("metadata");

  return {
    title: t("contact.title"),
    description: t("contact.description"),
    keywords: t("contact.keywords")
      .split(",")
      .map((k) => k.trim()),
    openGraph: {
      title: t("contact.title"),
      description: t("contact.description"),
      type: "website",
      siteName: "Shortn",
    },
    twitter: {
      card: "summary_large_image",
      title: t("contact.title"),
      description: t("contact.description"),
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
  const t = await getTranslations("contact");

  return (
    <MarketingPage>
      <MarketingHero
        title={t("title")}
        subtitle={t("subtitle")}
        aside={
          <div className="grid gap-10 lg:grid-cols-[minmax(0,0.72fr)_minmax(0,1fr)]">
            <div className="space-y-5">
              <div className="border-t border-primary/10 pt-4">
                <a
                  href="mailto:geral@shortn.at"
                  className="mt-2 flex items-center gap-3 text-sm text-muted-foreground transition-colors hover:text-primary"
                >
                  <Mail className="h-4 w-4" />
                  geral@shortn.at
                </a>
              </div>
              <div className="border-t border-primary/10 pt-4">
                <a
                  href="tel:+351926316228"
                  className="mt-2 flex items-center gap-3 text-sm text-muted-foreground transition-colors hover:text-primary"
                >
                  <PhoneCall className="h-4 w-4" />
                  +351 926316228
                </a>
              </div>
              <div className="border-t border-primary/10 pt-4">
                <div className="mt-3 flex items-center gap-4 text-muted-foreground">
                  <a
                    href="https://x.com/denizlg24"
                    target="_blank"
                    rel="noreferrer"
                  >
                    <FaXTwitter className="h-5 w-5" />
                  </a>
                  <a
                    href="https://www.facebook.com/denizlg24"
                    target="_blank"
                    rel="noreferrer"
                  >
                    <Facebook className="h-5 w-5" />
                  </a>
                  <a
                    href="https://www.instagram.com/denizlg24"
                    target="_blank"
                    rel="noreferrer"
                  >
                    <Instagram className="h-5 w-5" />
                  </a>
                </div>
              </div>
            </div>
            <div className="border-t border-primary/10 pt-5">
              <ContactForm />
            </div>
          </div>
        }
      />
    </MarketingPage>
  );
}
