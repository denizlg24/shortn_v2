import { buttonVariants, cn } from "@shortn/ui";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { notFound, redirect } from "next/navigation";
import { legalDocuments } from "@/components/marketing/legal";
import { LegalPage } from "@/components/marketing/legal-page";
import { shortLinkKey } from "@/lib/marketing/short-link";
import { env } from "@/server/env";
import { marketingMetadata, toLocale } from "@/server/marketing";

export async function generateMetadata({
  params,
}: PageProps<"/_marketing/[locale]/abuse">): Promise<Metadata> {
  const locale = toLocale((await params).locale);
  return locale ? marketingMetadata(locale, "abuse") : {};
}

// "Report a link" lands here; reports themselves are filed on the link's
// safety page, which already rate-limits and counts them.
export default async function AbusePage({
  params,
  searchParams,
}: PageProps<"/_marketing/[locale]/abuse">) {
  const locale = toLocale((await params).locale);
  if (!locale) notFound();
  const { link } = await searchParams;
  const domain = env().LINK_DOMAIN;
  const submitted = typeof link === "string" ? link : null;
  const key = submitted
    ? shortLinkKey(submitted, [domain, new URL(env().PUBLIC_ORIGIN).hostname])
    : null;
  if (key) redirect(`/${locale}/safety/${encodeURIComponent(key)}`);
  const t = await getTranslations({ locale, namespace: "marketing.abuse" });
  return (
    <LegalPage
      locale={locale}
      document={legalDocuments.abuse}
      notice={t("authoritative")}
    >
      <section
        aria-labelledby="report"
        className="max-w-[40rem] border-t border-line pt-10"
      >
        <h2
          id="report"
          className="scroll-mt-6 font-display text-subhead font-extrabold tracking-[-0.02em]"
        >
          {t("report")}
        </h2>
        <p className="mt-3 text-body text-pretty text-fg-muted">
          {t("reportForm.body")}
        </p>
        <form
          action={`/${locale}/abuse#report`}
          method="get"
          className="mt-6 flex flex-col gap-2"
        >
          <label htmlFor="report-link" className="text-small font-medium">
            {t("reportForm.label")}
          </label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              id="report-link"
              name="link"
              required
              defaultValue={submitted ?? ""}
              placeholder={t("reportForm.placeholder", { domain })}
              aria-invalid={submitted ? true : undefined}
              aria-describedby={submitted ? "report-error" : undefined}
              autoComplete="off"
              spellCheck={false}
              className="h-11 w-full min-w-0 rounded-control border border-line-strong bg-field px-3 sm:flex-1 text-emphasis outline-none placeholder:text-fg-subtle focus-visible:border-signal focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-signal aria-invalid:border-danger"
            />
            <button
              type="submit"
              className={cn(
                buttonVariants({ variant: "primary", size: "lg" }),
                "h-11 px-5",
              )}
            >
              {t("reportForm.submit")}
            </button>
          </div>
          {submitted ? (
            <p id="report-error" role="alert" className="text-body text-danger">
              {t("reportForm.invalid", { domain })}
            </p>
          ) : null}
        </form>
      </section>
    </LegalPage>
  );
}
