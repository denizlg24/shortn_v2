import DotGrid from "@/components/DotGrid";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { use } from "react";
import { ContactForm } from "./contact-form";
import { FaXTwitter } from "react-icons/fa6";
import { Facebook, Instagram, Mail, PhoneCall } from "lucide-react";
import { Separator } from "@/components/ui/separator";

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

export default function Home({
  params,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  params: any;
}) {
  const { locale } = use<{ locale: string }>(params);
  setRequestLocale(locale);
  return (
    <main className="flex flex-col items-center w-full mx-auto relative">
      <div className="absolute w-full h-full sm:-mt-16 -mt-12 -mx-4 -z-10">
        <div className="relative w-full h-full">
          <DotGrid
            dotSize={4}
            gap={25}
            baseColor="#f1f5f9"
            activeColor="#0f172b"
            proximity={120}
            shockRadius={250}
            shockStrength={5}
            resistance={750}
            returnDuration={1.5}
          />
        </div>
      </div>

      <div className="hover:backdrop-blur-3xl transition-all px-4 sm:my-24 my-16 text-center  w-full max-w-4xl mx-auto flex flex-col items-center gap-6 ">
        <h1 className="md:text-7xl sm:text-6xl xs:text-5xl text-4xl font-black">
          Get in touch
        </h1>
        <h2 className="text-lg text-muted-foreground max-w-xl text-center">
          Have a question or need help? We'd love to hear from you. Send us a
          message and we'll respond as soon as possible.
        </h2>
      </div>
      <div className="w-full pb-12 px-2">
        <div className="w-full max-w-5xl mx-auto">
          <div className="grid grid-cols-2 text-left w-full gap-6 bg-background/80 backdrop-blur-sm border rounded-lg p-6 drop-shadow-xl">
            <ContactForm className="col-span-full w-full" />
          </div>
        </div>
      </div>
      <div className="sm:my-20 my-12 text-center flex flex-col items-center gap-6 px-4 w-full max-w-4xl mx-auto">
        <h1 className="md:text-4xl sm:text-3xl xs:text-2xl text-xl font-bold">
          Keep in touch with us
        </h1>
        <h2 className="text-lg text-muted-foreground max-w-xl text-center">
          Follow us on social media for the latest updates, tips, and news.
        </h2>
        <div className="w-full flex flex-row items-center gap-4 flex-wrap justify-center hover:backdrop-blur-3xl p-4">
          <a
            href="https://x.com/denizlg24"
            target="_blank"
            rel="noopener noreferrer"
          >
            <FaXTwitter className="w-6 h-6" />
          </a>
          <a
            href="https://www.facebook.com/denizlg24"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Facebook className="w-6 h-6" />
          </a>
          <a
            href="https://www.instagram.com/denizlg24"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Instagram className="w-6 h-6" />
          </a>
        </div>
        <div className="flex flex-row items-center gap-2 w-full max-w-3xl mx-auto px-4">
          <Separator className="grow flex-1" />
          <p className="shrink-0 xs:text-sm text-xs text-muted-foreground font-medium">
            OR
          </p>
          <Separator className="grow flex-1" />
        </div>
        <div className="w-full flex flex-row items-center gap-4 flex-wrap justify-center hover:backdrop-blur-3xl p-4">
          <a
            href="mailto:geral@oceaninformatix.com"
            target="_blank"
            className="flex flex-row items-center gap-2 justify-start"
            rel="noopener noreferrer"
          >
            <Mail className="w-4 h-4" />
            geral@oceaninformatix.com
          </a>
          <a
            href="mailto:geral@oceaninformatix.com"
            target="_blank"
            className="flex flex-row items-center gap-2 justify-start"
            rel="noopener noreferrer"
          >
            <PhoneCall className="w-4 h-4" />
            +351 926316228
          </a>
        </div>
      </div>
    </main>
  );
}
