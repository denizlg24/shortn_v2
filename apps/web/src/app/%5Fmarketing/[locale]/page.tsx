import { plans, planIds } from "@shortn/billing";
import { buttonVariants, cn } from "@shortn/ui";
import { ArrowRight } from "lucide-react";
import type { Metadata } from "next";
import { getFormatter, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { HeroStage, type HeroLabels } from "@/components/marketing/hero-stage";
import { LaunchVideo } from "@/components/marketing/launch-video";
import { ProductShot } from "@/components/marketing/product-shot";
import {
  ClosingBand,
  Container,
  Points,
  SectionHeading,
} from "@/components/marketing/section";
import { proof } from "@/lib/marketing/proof";
import { demoConfig } from "@/server/demo";
import { appHref, marketingMetadata, toLocale } from "@/server/marketing";
import { qrModules } from "@/server/qr-modules";

export async function generateMetadata({
  params,
}: PageProps<"/_marketing/[locale]">): Promise<Metadata> {
  const locale = toLocale((await params).locale);
  return locale ? marketingMetadata(locale, "") : {};
}

const exampleUrl = "https://shortn.at/spring-issue";

const launchVideo = {
  src: "/_web/marketing/shortn-launch.mp4",
  poster: "/_web/marketing/shortn-launch-poster.jpg",
};

export default async function HomePage({
  params,
}: PageProps<"/_marketing/[locale]">) {
  const locale = toLocale((await params).locale);
  if (!locale) notFound();
  const [t, tShots, format] = await Promise.all([
    getTranslations({ locale, namespace: "marketing.home" }),
    getTranslations({ locale, namespace: "marketing.shots" }),
    getFormatter({ locale }),
  ]);
  const registerHref = appHref("/register");
  const demo = demoConfig();

  const labels: HeroLabels = {
    primary: t("hero.primary"),
    secondary: t("hero.secondary"),
    reassurance: t("hero.reassurance"),
    example: t("demo.example"),
    destination: t("demo.destination"),
    label: t("demo.label"),
    placeholder: t("demo.placeholder"),
    submit: t("demo.submit"),
    submitting: t("demo.submitting"),
    resultLabel: t("demo.resultLabel"),
    copy: t("demo.copy"),
    copied: t("demo.copied"),
    open: t("demo.open"),
    qrAlt: t.raw("demo.qrAlt") as string,
    downloadQr: t("demo.downloadQr"),
    expiry: t("demo.expiry"),
    keep: t("demo.keep"),
    another: t("demo.another"),
    report: t("demo.report"),
    errors: {
      invalid: t("demo.errors.invalid"),
      blocked: t("demo.errors.blocked"),
      rateLimited: t("demo.errors.rateLimited"),
      capReached: t("demo.errors.capReached"),
      challenge: t("demo.errors.challenge"),
      unavailable: t("demo.errors.unavailable"),
    },
  };

  const number = (value: number) => format.number(value);
  const figures = [
    { key: "clicks", ...proof.figures.clicks, label: t("proof.stats.clicks") },
    { key: "links", ...proof.figures.links, label: t("proof.stats.links") },
    {
      key: "qrCodes",
      ...proof.figures.qrCodes,
      label: t("proof.stats.qrCodes"),
    },
    {
      key: "scans",
      ...proof.figures.scans,
      label: t("proof.stats.scans", {
        month: format.dateTime(new Date(proof.scansSince), {
          month: "long",
          year: "numeric",
          timeZone: "UTC",
        }),
      }),
    },
  ];
  const cheapest = Math.min(
    ...planIds
      .map((id) => plans[id].priceUsdMonthly)
      .filter((price): price is number => price !== null && price > 0),
  );
  const usd = (value: number) =>
    format.number(value, {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    });

  return (
    <>
      <section className="band">
        <Container className="pt-12 pb-16 md:pt-20 md:pb-20">
          <HeroStage
            locale={locale}
            demo={demo ? { siteKey: demo.siteKey } : null}
            example={{
              shortUrl: exampleUrl,
              key: "spring-issue",
              destination:
                "https://example.com/magazine/2026/spring-issue?utm_source=print",
              qr: qrModules(exampleUrl),
            }}
            labels={labels}
            registerHref={registerHref}
            pricingHref={`/${locale}/pricing`}
            intro={
              <>
                <h1 className="max-w-[16ch] font-display text-display font-extrabold tracking-[-0.035em] text-balance">
                  {t("hero.title")}
                </h1>
                <p className="mt-6 max-w-[48ch] text-lede text-pretty text-fg-muted">
                  {t("hero.body")}
                </p>
              </>
            }
          />
          <div className="mt-16 grid gap-10 border-t border-line pt-10 lg:mt-20 lg:grid-cols-12">
            <div className="flex flex-col gap-3 lg:col-span-7">
              <h2 className="font-display text-subhead font-bold tracking-[-0.02em] text-balance">
                {t("proof.title")}
              </h2>
              <p className="text-body text-pretty text-fg-muted">
                {t("proof.body")}
              </p>
            </div>
            <dl className="grid grid-cols-2 gap-y-8 lg:col-span-12 lg:grid-cols-4">
              {figures.map((figure, index) => (
                <div
                  key={figure.key}
                  className={cn(
                    "flex flex-col-reverse gap-2 pr-4",
                    index % 2 === 1 && "border-l border-line pl-4 lg:pl-6",
                    index > 0 && "lg:border-l lg:pl-6",
                  )}
                >
                  <dt className="text-small text-pretty text-fg-muted">
                    {figure.label}
                  </dt>
                  <dd className="font-display text-figure font-extrabold tracking-[-0.03em]">
                    {number(figure.value)}
                    {figure.plus ? "+" : ""}
                  </dd>
                </div>
              ))}
            </dl>
            <p className="text-meta text-fg-subtle lg:col-span-12">
              {t("proof.source", {
                date: format.dateTime(new Date(proof.measuredOn), {
                  dateStyle: "long",
                  timeZone: "UTC",
                }),
              })}
            </p>
          </div>
        </Container>
      </section>

      <section className="border-b border-line py-20 md:py-28">
        <Container className="flex flex-col gap-10 md:gap-12">
          <SectionHeading title={t("video.title")} body={t("video.body")} />
          <figure className="flex flex-col gap-2">
            <div className="aspect-video overflow-hidden rounded-overlay border border-line bg-bg-subtle">
              <LaunchVideo
                src={launchVideo.src}
                poster={launchVideo.poster}
                label={t("video.label")}
              />
            </div>
            <figcaption className="text-meta text-fg-subtle">
              {t("video.caption")}
            </figcaption>
          </figure>
        </Container>
      </section>

      <section className="py-20 md:py-28">
        <Container className="grid items-center gap-12 lg:grid-cols-12">
          <div className="flex flex-col gap-8 lg:col-span-5">
            <SectionHeading title={t("print.title")} body={t("print.body")} />
            <Points
              items={[
                t("print.points.formats"),
                t("print.points.style"),
                t("print.points.bulk"),
              ]}
            />
          </div>
          <ProductShot
            name="qrDesign"
            alt={tShots("qrDesign")}
            caption
            className="lg:col-span-7"
          />
        </Container>
      </section>

      <section className="border-t border-line bg-bg-subtle py-20 md:py-28">
        <Container className="flex flex-col gap-12">
          <div className="flex flex-col items-start gap-6 md:flex-row md:items-end md:justify-between">
            <SectionHeading title={t("manage.title")} body={t("manage.body")} />
            <a
              href={`/${locale}/features`}
              className="group inline-flex items-center gap-1.5 text-emphasis font-medium text-signal"
            >
              {t("manage.cta")}
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
            </a>
          </div>
          <ProductShot name="links" alt={tShots("links")} />
        </Container>
      </section>

      <section className="py-20 md:py-28">
        <Container className="grid items-center gap-12 lg:grid-cols-12">
          <ProductShot
            name="analytics"
            alt={tShots("analytics")}
            className="lg:order-1 lg:col-span-7"
          />
          <SectionHeading
            className="lg:order-2 lg:col-span-5"
            title={t("analytics.title")}
            body={t("analytics.body")}
          />
        </Container>
      </section>

      <section className="border-t border-line py-20 md:py-28">
        <Container className="grid gap-12 lg:grid-cols-12">
          <div className="flex flex-col items-start gap-6 lg:col-span-5">
            <SectionHeading
              title={t("developers.title")}
              body={t("developers.body")}
            />
            <a
              href="/docs"
              className="group inline-flex items-center gap-1.5 text-emphasis font-medium text-signal"
            >
              {t("developers.cta")}
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
            </a>
          </div>
          <figure className="min-w-0 overflow-hidden rounded-overlay border border-line bg-bg-subtle lg:col-span-7 lg:self-start">
            <figcaption className="flex h-10 items-center border-b border-line px-4 font-mono text-meta text-fg-muted">
              {t("developers.codeLabel")}
            </figcaption>
            <pre className="overflow-x-auto p-5 font-mono text-small leading-6 text-fg">
              <code>
                <span className="text-fg-subtle">$ </span>curl
                https://api.shortn.at/v1/links \{"\n"}
                {"    "}-H{" "}
                <span className="text-fg-muted">
                  &quot;Authorization: Bearer $SHORTN_API_KEY&quot;
                </span>{" "}
                \{"\n"}
                {"    "}-H{" "}
                <span className="text-fg-muted">
                  &quot;Content-Type: application/json&quot;
                </span>{" "}
                \{"\n"}
                {"    "}-d{" "}
                <span className="text-fg-muted">{`'{"url": "https://example.com/spring-issue"}'`}</span>
              </code>
            </pre>
          </figure>
        </Container>
      </section>

      <section className="border-t border-line bg-bg-subtle py-20 md:py-24">
        <Container className="flex flex-col items-start gap-8 md:flex-row md:items-end md:justify-between">
          <SectionHeading
            title={t("pricing.title")}
            body={t("pricing.body", {
              links: plans.free.limits.links ?? 0,
              qrCodes: plans.free.limits.qrCodes ?? 0,
              price: usd(cheapest),
            })}
          />
          <a
            href={`/${locale}/pricing`}
            className={cn(buttonVariants({ size: "lg" }), "h-11 px-5")}
          >
            {t("pricing.cta")}
          </a>
        </Container>
      </section>

      <ClosingBand
        title={t("cta.title")}
        body={t("cta.body")}
        primary={{ href: registerHref, label: t("cta.primary") }}
        secondary={{ href: `/${locale}/contact`, label: t("cta.secondary") }}
      />
    </>
  );
}
