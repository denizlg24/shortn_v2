import {
  features,
  planIds,
  plans,
  type Feature,
  type PlanId,
  type PlanLimits,
} from "@shortn/billing";
import { buttonVariants, cn } from "@shortn/ui";
import { Check, Minus, Plus } from "lucide-react";
import type { Metadata } from "next";
import { getFormatter, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Container, PageHead } from "@/components/marketing/section";
import {
  appHref,
  freshEurPerUsd,
  marketingMetadata,
  toLocale,
} from "@/server/marketing";

export async function generateMetadata({
  params,
}: PageProps<"/_marketing/[locale]/pricing">): Promise<Metadata> {
  const locale = toLocale((await params).locale);
  return locale ? marketingMetadata(locale, "pricing") : {};
}

const recommended: PlanId = "pro";
const limitRows = [
  ["links", "unlimitedLinks"],
  ["qrCodes", "unlimitedQrCodes"],
  ["bioPages", "unlimitedBioPages"],
  ["seats", "unlimitedSeats"],
  ["workspaces", "unlimitedWorkspaces"],
  ["analyticsDays", "unlimitedAnalytics"],
] as const;
const faq = [
  "limits",
  "downgrade",
  "currency",
  "invoices",
  "enterprise",
] as const;
// SSO is Enterprise-only and lives outside the plan feature list (21 §4).
const compareRows = [...features, "sso"] as const;
type CompareRow = Feature | "sso";
const included = (plan: PlanId, row: CompareRow) =>
  row === "sso"
    ? plan === "enterprise"
    : (plans[plan].features as readonly Feature[]).includes(row);

export default async function PricingPage({
  params,
}: PageProps<"/_marketing/[locale]/pricing">) {
  const locale = toLocale((await params).locale);
  if (!locale) notFound();
  const [t, format, eurPerUsd] = await Promise.all([
    getTranslations({ locale, namespace: "marketing.pricing" }),
    getFormatter({ locale }),
    freshEurPerUsd(),
  ]);
  const usd = (value: number) =>
    format.number(value, {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    });
  const eur = (value: number) =>
    format.number(value, { style: "currency", currency: "EUR" });
  const registerHref = appHref("/register");
  const checkoutHref = `${registerHref}?next=${encodeURIComponent("/?to=settings/billing")}`;

  const limitLines = (limits: PlanLimits) =>
    limitRows.map(([field, unlimited]) => {
      const value = limits[field];
      return value === null
        ? t(`limits.${unlimited}`)
        : t(`limits.${field}`, { count: value });
    });
  const apiLine = (id: PlanId) => {
    const value = plans[id].limits.apiPerMinute;
    if (!plans[id].features.includes("api")) return t("limits.noApi");
    return value === null
      ? t("limits.unlimitedApi")
      : t("limits.apiPerMinute", { count: value });
  };

  return (
    <>
      <PageHead title={t("title")} intro={t("intro")} />
      <Container className="py-14 md:py-20">
        <div className="grid border-t border-line sm:grid-cols-2 lg:grid-cols-5">
          {planIds.map((id) => {
            const plan = plans[id];
            const price = plan.priceUsdMonthly;
            const isRecommended = id === recommended;
            return (
              <section
                key={id}
                aria-labelledby={`plan-${id}`}
                className={cn(
                  "relative flex flex-col gap-6 border-b border-line px-1 py-8 sm:px-5 lg:border-b-0 lg:border-l lg:first:border-l-0 lg:first:pl-0",
                  isRecommended &&
                    "band -mx-4 px-5 sm:mx-0 lg:-mt-px lg:rounded-b-overlay lg:border-l-0",
                )}
              >
                <div className="flex min-h-7 items-center justify-between gap-2">
                  <h2
                    id={`plan-${id}`}
                    className="font-display text-subhead font-extrabold tracking-[-0.02em]"
                  >
                    {t(`plans.${id}.name`)}
                  </h2>
                  {isRecommended ? (
                    <span className="rounded-chip bg-primary px-2 py-0.5 text-meta font-medium text-primary-fg">
                      {t("recommended")}
                    </span>
                  ) : null}
                </div>
                <p className="min-h-10 text-body text-pretty text-fg-muted">
                  {t(`plans.${id}.summary`)}
                </p>
                <div className="flex min-h-16 flex-col gap-1">
                  {price === null ? (
                    <p className="font-display text-subhead font-bold">
                      {t("custom")}
                    </p>
                  ) : (
                    <>
                      <p className="font-display text-[1.875rem] leading-tight font-extrabold tracking-[-0.03em] whitespace-nowrap">
                        {t("perMonth", { price: usd(price) })}
                      </p>
                      {eurPerUsd && price > 0 ? (
                        <p className="text-small text-fg-muted tabular-nums">
                          {t("eurEstimate", { eur: eur(price * eurPerUsd) })}
                        </p>
                      ) : null}
                    </>
                  )}
                </div>
                <a
                  href={
                    id === "enterprise"
                      ? `/${locale}/contact`
                      : id === "free"
                        ? registerHref
                        : checkoutHref
                  }
                  className={cn(
                    buttonVariants({
                      variant: isRecommended ? "primary" : "secondary",
                      size: "lg",
                    }),
                    "h-11",
                  )}
                >
                  {t(`plans.${id}.cta`)}
                </a>
                <ul className="flex flex-col gap-2.5 text-body">
                  {[...limitLines(plan.limits), apiLine(id)].map((line) => (
                    <li key={line} className="flex gap-2 text-pretty">
                      <Check
                        aria-hidden
                        className="mt-0.5 size-4 shrink-0 text-fg-muted"
                      />
                      {line}
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
        <p className="mt-8 max-w-[70ch] text-small text-pretty text-fg-muted">
          {t("currencyNote")}
        </p>
      </Container>

      <section
        aria-labelledby="compare"
        className="border-t border-line py-14 md:py-20"
      >
        <Container>
          <h2
            id="compare"
            className="font-display text-headline font-extrabold tracking-[-0.03em]"
          >
            {t("compare.title")}
          </h2>
          <p className="mt-4 text-small text-fg-muted md:hidden">
            {t("compare.scrollHint")}
          </p>
          <div className="mt-8 overflow-x-auto">
            <table className="w-full min-w-[44rem] border-collapse text-body">
              <thead>
                <tr className="border-b border-line-strong text-left">
                  <th
                    scope="col"
                    className="py-3 pr-4 font-medium text-fg-muted"
                  >
                    {t("compare.feature")}
                  </th>
                  {planIds.map((id) => (
                    <th
                      key={id}
                      scope="col"
                      className="w-[13%] px-2 py-3 text-center font-semibold"
                    >
                      {t(`plans.${id}.name`)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {compareRows.map((row) => (
                  <tr key={row} className="border-b border-line">
                    <th
                      scope="row"
                      className="sticky left-0 z-10 min-w-36 bg-bg py-3 pr-4 text-left font-normal"
                    >
                      {t(`featureNames.${row}`)}
                    </th>
                    {planIds.map((id) => (
                      <td key={id} className="px-2 py-3 text-center">
                        {included(id, row) ? (
                          <Check
                            role="img"
                            aria-label={t("compare.included")}
                            className="mx-auto size-4 text-fg"
                          />
                        ) : (
                          <Minus
                            role="img"
                            aria-label={t("compare.notIncluded")}
                            className="mx-auto size-4 text-fg-subtle"
                          />
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Container>
      </section>

      <section className="border-t border-line bg-bg-subtle py-14 md:py-20">
        <Container className="grid gap-12 lg:grid-cols-12">
          <div className="flex flex-col gap-3 lg:col-span-4">
            <h2 className="font-display text-subhead font-extrabold tracking-[-0.02em]">
              {t("addon.title")}
            </h2>
            <p className="text-body text-pretty text-fg-muted">
              {t("addon.body")}
            </p>
          </div>
          <div className="lg:col-span-8">
            <h2 className="font-display text-headline font-extrabold tracking-[-0.03em]">
              {t("faq.title")}
            </h2>
            <div className="mt-6 border-t border-line">
              {faq.map((key) => (
                <details key={key} className="group border-b border-line">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 text-emphasis font-medium [&::-webkit-details-marker]:hidden">
                    {t(`faq.${key}.question`)}
                    <Plus
                      aria-hidden
                      className="size-4 shrink-0 text-fg-subtle transition-transform duration-(--motion-base) group-open:rotate-45"
                    />
                  </summary>
                  <p className="max-w-[65ch] pb-5 text-body text-pretty text-fg-muted">
                    {t(`faq.${key}.answer`)}
                  </p>
                </details>
              ))}
            </div>
          </div>
        </Container>
      </section>
    </>
  );
}
