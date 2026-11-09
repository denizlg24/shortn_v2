import { plans, planIds } from "@shortn/billing";
import { buttonVariants, cn } from "@shortn/ui";
import { ArrowRight } from "lucide-react";
import type { Metadata } from "next";
import { getFormatter, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import {
  ChannelGraph,
  channelIds,
  type ChannelId,
} from "@/components/marketing/channel-graph";
import {
  FeatureShowcase,
  type ShowcaseItem,
} from "@/components/marketing/feature-showcase";
import { HeroStage, type HeroLabels } from "@/components/marketing/hero-stage";
import { LaunchVideo } from "@/components/marketing/launch-video";
import {
  Container,
  InsetBand,
  SplitHeading,
} from "@/components/marketing/section";
import { shots, type ShotName } from "@/components/marketing/shots";
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

const showcase = [
  { id: "print", shot: "qrDesign" },
  { id: "manage", shot: "links" },
  { id: "analytics", shot: "analytics" },
  { id: "bio", shot: "bioEditor" },
] as const satisfies readonly { id: string; shot: ShotName }[];

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

  const showcaseItems: ShowcaseItem[] = showcase.map(({ id, shot }) => ({
    id,
    title: t(`showcase.items.${id}.title`),
    body: t(`showcase.items.${id}.body`),
    alt: tShots(shot),
    light: capture(shots[shot].light),
    dark: capture(shots[shot].dark),
  }));

  const channelLabels = Object.fromEntries(
    channelIds.map((id) => [id, t(`channels.items.${id}`)]),
  ) as Record<ChannelId, string>;

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
      <section className="band relative isolate overflow-hidden">
        <div
          aria-hidden
          className="hero-grid pointer-events-none absolute inset-0 -z-10"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute top-[22rem] left-1/2 -z-10 aspect-square w-[160%] -translate-x-1/2 rounded-full ring-1 ring-white/[0.06] md:top-[26rem] md:w-[118%]"
        />
        <Container className="pt-12 pb-20 md:pt-20 md:pb-28">
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
        </Container>
      </section>

      <div className="relative isolate">
        <div aria-hidden className="band absolute inset-x-0 top-0 -z-10 h-1/2">
          <div className="hero-glow absolute -bottom-16 left-1/2 h-full w-[96%] -translate-x-1/2" />
        </div>
        <Container>
          <figure className="flex flex-col gap-3">
            <div className="rounded-[18px] bg-white/[0.06] p-1.5 shadow-[0_40px_90px_-40px_oklch(0.2_0.06_265/65%)] ring-1 ring-white/15 md:rounded-[22px] md:p-2">
              <div className="aspect-video overflow-hidden rounded-[12px] bg-bg-subtle md:rounded-[15px]">
                <LaunchVideo
                  src={launchVideo.src}
                  poster={launchVideo.poster}
                  label={t("video.label")}
                />
              </div>
            </div>
            <figcaption className="text-meta text-fg-subtle">
              {t("video.caption")}
            </figcaption>
          </figure>
        </Container>
      </div>

      <section aria-labelledby="showcase-title" className="py-24 md:py-32">
        <Container className="flex flex-col gap-14 md:gap-16">
          <SplitHeading
            id="showcase-title"
            lead={t("showcase.title")}
            tail={t("showcase.titleMuted")}
            className="max-w-[24ch]"
          />
          <FeatureShowcase items={showcaseItems} />
          <a
            href={`/${locale}/features`}
            className="group inline-flex items-center gap-1.5 self-start rounded-control text-emphasis font-medium text-signal"
          >
            {t("showcase.cta")}
            <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
          </a>
        </Container>
      </section>

      <InsetBand aria-labelledby="channels-title">
        <div
          aria-hidden
          className="hero-grid pointer-events-none absolute inset-0 -z-10"
        />
        <Container className="flex flex-col gap-14 py-20 md:gap-20 md:py-28">
          <div className="grid items-end gap-6 lg:grid-cols-12">
            <SplitHeading
              id="channels-title"
              lead={t("channels.title")}
              tail={t("channels.titleMuted")}
              className="lg:col-span-7"
            />
            <p className="max-w-[44ch] text-lede text-pretty text-fg-muted lg:col-span-5 lg:justify-self-end">
              {t("channels.body")}
            </p>
          </div>
          <ChannelGraph labels={channelLabels} hubLabel={t("channels.hub")} />
        </Container>
      </InsetBand>

      <section aria-labelledby="proof-title" className="py-24 md:py-36">
        <Container>
          <div className="mx-auto max-w-[64rem]">
            <h2
              id="proof-title"
              className="max-w-[34ch] font-display text-[clamp(1.5rem,1.1rem+1.6vw,2.375rem)] leading-[1.25] font-extrabold tracking-[-0.025em] text-pretty"
            >
              {t("proof.statement")}{" "}
              <span className="text-fg-subtle">
                {t("proof.statementMuted")}
              </span>
            </h2>
            <dl className="mt-16 grid grid-cols-2 gap-x-6 gap-y-10 md:mt-20 lg:grid-cols-4 lg:gap-x-8">
              {figures.map((figure) => (
                <div key={figure.key} className="flex flex-col">
                  <dd className="order-1 border-b border-line pb-4 font-display text-[clamp(1.75rem,1.2rem+1.6vw,2.75rem)] leading-none font-extrabold tracking-[-0.03em] whitespace-nowrap">
                    {format.number(figure.value)}
                    {figure.plus ? "+" : ""}
                  </dd>
                  <dt className="order-2 pt-3 text-small text-pretty text-fg-muted">
                    {figure.label}
                  </dt>
                </div>
              ))}
            </dl>
            <p className="mt-10 text-meta text-fg-subtle">
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

      <section
        aria-labelledby="developers-title"
        className="border-t border-line py-24 md:py-32"
      >
        <Container className="grid gap-12 lg:grid-cols-12 lg:gap-10">
          <SplitHeading
            id="developers-title"
            lead={t("developers.title")}
            tail={t("developers.titleMuted")}
            className="max-w-[22ch] lg:col-span-12"
          />
          <div className="flex flex-col items-start gap-6 lg:col-span-5">
            <p className="max-w-[44ch] text-lede text-pretty text-fg-muted">
              {t("developers.body")}
            </p>
            <a
              href="/docs"
              className="group inline-flex items-center gap-1.5 rounded-control text-emphasis font-medium text-signal"
            >
              {t("developers.cta")}
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
            </a>
          </div>
          <figure className="band min-w-0 overflow-hidden rounded-[18px] ring-1 ring-line lg:col-span-7 lg:self-start">
            <figcaption className="flex h-11 items-center gap-3 border-b border-line px-4 text-meta text-fg-muted">
              <span className="font-mono">{t("developers.codeLabel")}</span>
            </figcaption>
            <pre className="overflow-x-auto p-5 font-mono text-small leading-6 text-fg md:p-6">
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

      <section className="border-t border-line py-16 md:py-20">
        <Container className="flex flex-col items-start gap-8 md:flex-row md:items-end md:justify-between">
          <div className="flex max-w-[40rem] flex-col gap-4">
            <h2 className="font-display text-subhead font-extrabold tracking-[-0.02em] text-balance">
              {t("pricing.title")}
            </h2>
            <p className="text-lede text-pretty text-fg-muted">
              {t("pricing.body", {
                links: plans.free.limits.links ?? 0,
                qrCodes: plans.free.limits.qrCodes ?? 0,
                price: usd(cheapest),
              })}
            </p>
          </div>
          <a
            href={`/${locale}/pricing`}
            className={cn(buttonVariants({ size: "lg" }), "h-11 px-5")}
          >
            {t("pricing.cta")}
          </a>
        </Container>
      </section>

      <InsetBand aria-labelledby="cta-title" className="mb-2 md:mb-3">
        <div
          aria-hidden
          className="hero-glow pointer-events-none absolute -bottom-1/2 left-1/2 -z-10 h-full w-[80%] -translate-x-1/2 opacity-80"
        />
        <Container className="flex flex-col items-center gap-6 py-24 text-center md:py-32">
          <h2
            id="cta-title"
            className="max-w-[18ch] font-display text-display font-extrabold tracking-[-0.035em] text-balance"
          >
            {t("cta.title")}
          </h2>
          <p className="max-w-[44ch] text-lede text-pretty text-fg-muted">
            {t("cta.body")}
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <a
              href={registerHref}
              className={cn(
                buttonVariants({ variant: "primary", size: "lg" }),
                "h-12 px-5 text-emphasis",
              )}
            >
              {t("cta.primary")}
              <ArrowRight />
            </a>
            <a
              href={`/${locale}/contact`}
              className={cn(
                buttonVariants({ size: "lg" }),
                "h-12 px-5 text-emphasis",
              )}
            >
              {t("cta.secondary")}
            </a>
          </div>
        </Container>
      </InsetBand>
    </>
  );
}

function capture(image: { src: string; width: number; height: number }) {
  return { src: image.src, width: image.width, height: image.height };
}
