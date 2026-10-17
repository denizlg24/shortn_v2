import { buttonVariants, cn } from "@shortn/ui";
import { ArrowRight } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Container, PageHead } from "@/components/marketing/section";
import { marketingMetadata, toLocale } from "@/server/marketing";

export async function generateMetadata({
  params,
}: PageProps<"/_marketing/[locale]/about">): Promise<Metadata> {
  const locale = toLocale((await params).locale);
  return locale ? marketingMetadata(locale, "about") : {};
}

const principles = ["honest", "durable", "private", "open"] as const;

export default async function AboutPage({
  params,
}: PageProps<"/_marketing/[locale]/about">) {
  const locale = toLocale((await params).locale);
  if (!locale) notFound();
  const t = await getTranslations({ locale, namespace: "marketing.about" });
  return (
    <>
      <PageHead title={t("title")} intro={t("intro")} />
      <section aria-labelledby="principles" className="py-16 md:py-24">
        <Container>
          <h2
            id="principles"
            className="font-display text-headline font-extrabold tracking-[-0.03em]"
          >
            {t("principles.title")}
          </h2>
          <div className="mt-10 grid border-t border-line md:grid-cols-2">
            {principles.map((key, index) => (
              <div
                key={key}
                className={cn(
                  "flex flex-col gap-3 border-b border-line py-8 md:pr-10",
                  index % 2 === 1 && "md:border-l md:pl-10",
                )}
              >
                <h3 className="font-display text-subhead font-bold tracking-[-0.02em]">
                  {t(`principles.${key}.title`)}
                </h3>
                <p className="max-w-[46ch] text-emphasis text-pretty text-fg-muted">
                  {t(`principles.${key}.body`)}
                </p>
              </div>
            ))}
          </div>
          <div className="mt-14 flex flex-col items-start gap-6 md:flex-row md:items-center md:justify-between">
            <p className="max-w-[48ch] text-lede text-pretty">
              {t("languages")}
            </p>
            <a
              href={`/${locale}/contact`}
              className={cn(
                buttonVariants({ variant: "primary", size: "lg" }),
                "h-11 px-5",
              )}
            >
              {t("cta")}
              <ArrowRight />
            </a>
          </div>
        </Container>
      </section>
    </>
  );
}
