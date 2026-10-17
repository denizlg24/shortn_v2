import { getFormatter, getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import type { Locale } from "@/i18n/locale";
import type { LegalDocument } from "./legal";
import { Container } from "./section";

export async function LegalPage({
  locale,
  document,
  notice,
  children,
}: {
  locale: Locale;
  document: LegalDocument;
  notice: string;
  children?: ReactNode;
}) {
  const [t, format] = await Promise.all([
    getTranslations({ locale, namespace: "marketing.legal" }),
    getFormatter({ locale }),
  ]);
  const { Body } = document;
  return (
    <>
      <section className="band">
        <Container className="pt-14 pb-14 md:pt-20 md:pb-16">
          <h1
            lang="en"
            className="font-display text-display font-extrabold tracking-[-0.035em] text-balance"
          >
            {document.title}
          </h1>
          <p className="mt-5 text-body text-fg-muted">
            {t("updated", {
              date: format.dateTime(new Date(document.updated), {
                dateStyle: "long",
                timeZone: "UTC",
              }),
            })}
          </p>
          {locale !== "en" ? (
            <p className="mt-6 max-w-[60ch] border-l border-line-strong pl-4 text-body text-pretty">
              {notice}
            </p>
          ) : null}
        </Container>
      </section>
      <Container className="grid gap-10 py-14 md:py-20 lg:grid-cols-12 lg:gap-12">
        <nav
          aria-labelledby="legal-contents"
          className="lg:sticky lg:top-8 lg:col-span-3 lg:self-start"
        >
          <h2
            id="legal-contents"
            className="text-small font-semibold text-fg-muted"
          >
            {t("contents")}
          </h2>
          <ol lang="en" className="mt-3 flex flex-col gap-1.5">
            {document.sections.map((section) => (
              <li key={section.id}>
                <a
                  href={`#${section.id}`}
                  className="text-small text-pretty text-fg-muted transition-colors hover:text-fg"
                >
                  {section.title}
                </a>
              </li>
            ))}
          </ol>
        </nav>
        <div className="flex flex-col gap-16 lg:col-span-9">
          <article lang="en" className="legal">
            <Body locale={locale} />
          </article>
          {children}
        </div>
      </Container>
    </>
  );
}
