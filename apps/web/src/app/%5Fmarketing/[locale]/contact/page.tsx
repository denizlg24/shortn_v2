import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { ContactForm } from "@/components/marketing/contact-form";
import { Container, PageHead } from "@/components/marketing/section";
import { env } from "@/server/env";
import { marketingMetadata, toLocale } from "@/server/marketing";

export async function generateMetadata({
  params,
}: PageProps<"/_marketing/[locale]/contact">): Promise<Metadata> {
  const locale = toLocale((await params).locale);
  return locale ? marketingMetadata(locale, "contact") : {};
}

export default async function ContactPage({
  params,
}: PageProps<"/_marketing/[locale]/contact">) {
  const locale = toLocale((await params).locale);
  if (!locale) notFound();
  const t = await getTranslations({ locale, namespace: "marketing.contact" });
  const e = env();
  return (
    <>
      <PageHead title={t("title")} intro={t("intro")} />
      <Container className="grid gap-12 py-14 md:py-20 lg:grid-cols-12">
        <aside className="lg:col-span-4">
          <p className="border-l border-line-strong pl-4 text-body text-pretty text-fg-muted">
            {t.rich("abuse", {
              link: (chunks) => (
                <a
                  href={`/${locale}/abuse#report`}
                  className="font-medium text-signal underline underline-offset-4"
                >
                  {chunks}
                </a>
              ),
            })}
          </p>
        </aside>
        <div className="lg:col-span-8 lg:max-w-[44rem]">
          <ContactForm
            locale={locale}
            siteKey={
              e.TURNSTILE_SECRET_KEY ? (e.TURNSTILE_SITE_KEY ?? null) : null
            }
          />
        </div>
      </Container>
    </>
  );
}
