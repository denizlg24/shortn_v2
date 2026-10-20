import { publicRequestDomain } from "@/server/public-domain";
import { env as publicEnv } from "@/server/env";
import { keyPattern, publicLink, reportReasons } from "@shortn/core";
import { buttonVariants, cn, Label, Textarea } from "@shortn/ui";
import { ChevronRight } from "lucide-react";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import { PublicFrame, PublicMessage } from "@/components/public/public-frame";
import { SafetyContinue } from "@/components/public/safety-continue";
import { Notice } from "@/components/settings/section";
import { isLocale, type Locale } from "@/i18n/locale";
import { db } from "@/server/db";

// The redirect sends flagged links to /{locale}/safety/{key}; next.config
// rewrites that here and passes the locale as a query parameter.
async function pageLocale(
  searchParams: Promise<Record<string, string | string[] | undefined>>,
): Promise<Locale> {
  const { locale } = await searchParams;
  return isLocale(locale) ? locale : getLocale();
}

export async function generateMetadata({
  searchParams,
}: PageProps<"/safety/[key]">): Promise<Metadata> {
  const locale = await pageLocale(searchParams);
  const t = await getTranslations({ locale, namespace: "public.safety" });
  return { title: t("metaTitle"), robots: { index: false, follow: false } };
}

const statusTone = {
  safe: "bg-success",
  suspicious: "bg-warning",
  malicious: "bg-danger",
  blocked: "bg-danger",
  pending: "bg-fg-subtle",
} as const;
const isStatus = (value: string): value is keyof typeof statusTone =>
  value in statusTone;

const reportStates = ["sent", "rate_limited", "invalid"] as const;
type ReportState = (typeof reportStates)[number];
const isReportState = (value: unknown): value is ReportState =>
  reportStates.some((state) => state === value);

export default async function SafetyPage({
  params,
  searchParams,
}: PageProps<"/safety/[key]">) {
  const [{ key }, query, locale] = await Promise.all([
    params,
    searchParams,
    pageLocale(searchParams),
  ]);
  const [t, tCommon, format] = await Promise.all([
    getTranslations({ locale, namespace: "public" }),
    getTranslations({ locale, namespace: "common" }),
    getFormatter({ locale }),
  ]);
  const home = { href: `https://shortn.at/${locale}`, label: t("goHome") };
  const link = keyPattern.test(key)
    ? await publicLink(
        await db(),
        key,
        await publicRequestDomain(),
        publicEnv().LINK_DOMAIN,
      )
    : null;
  const report = isReportState(query.report) ? query.report : null;
  const encodedKey = encodeURIComponent(key);

  const frame = (children: ReactNode) => (
    <PublicFrame locale={locale} brand={tCommon("brand")}>
      {children}
    </PublicFrame>
  );

  if (!link)
    return frame(
      <PublicMessage
        title={t("linkNotFound.title")}
        description={t("linkNotFound.body")}
        action={home}
      />,
    );

  if (link.blocked)
    return frame(
      link.disabledReason === "workspace:suspended" ? (
        <PublicMessage
          title={t("blocked.unavailableTitle")}
          description={t("blocked.suspended")}
          action={home}
        />
      ) : (
        <PublicMessage
          title={t("blocked.title")}
          description={
            link.disabledReason?.startsWith("auto:report")
              ? t("blocked.reported")
              : t("blocked.body")
          }
          action={home}
        />
      ),
    );

  const status = isStatus(link.safetyStatus) ? link.safetyStatus : "pending";
  const suspicious = status === "suspicious";
  const host = link.destinationHost;

  return frame(
    <>
      <h1 className="mb-2 flex flex-col gap-1">
        <span className="text-body text-fg-muted">{t("safety.leaving")}</span>
        <span className="text-section font-semibold tracking-[-0.02em] break-words">
          {host}
        </span>
      </h1>
      <p
        tabIndex={0}
        aria-label={t("safety.fullUrl")}
        className="mb-6 max-h-24 overflow-y-auto font-mono text-small break-all text-fg-muted"
      >
        {link.destination}
      </p>

      <dl className="mb-6 grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 border-y border-line py-4 text-small">
        <dt className="text-fg-muted">{t("safety.createdBy")}</dt>
        <dd className="min-w-0 truncate">
          {link.creatorName || t("safety.unknownCreator")}
        </dd>
        <dt className="text-fg-muted">{t("safety.createdOn")}</dt>
        <dd>
          {format.dateTime(new Date(link.createdAt), { dateStyle: "medium" })}
        </dd>
        <dt className="text-fg-muted">{t("safety.status")}</dt>
        <dd className="flex items-center gap-2">
          <span
            aria-hidden
            className={cn("size-2 shrink-0 rounded-full", statusTone[status])}
          />
          {t(`safety.statuses.${status}`)}
        </dd>
      </dl>

      <div className="flex flex-col gap-3">
        <SafetyContinue
          tokenUrl={`/${locale}/safety/${encodedKey}/token`}
          target={`/${encodedKey}`}
          labels={{
            wait: Object.fromEntries(
              [1, 2, 3].map((seconds) => [
                seconds,
                t("safety.wait", { seconds }),
              ]),
            ),
            continue: t("safety.continue", { host }),
            preparing: t("safety.preparing"),
            ready: t("safety.ready"),
            failed: t("safety.tokenFailed"),
            retry: t("safety.retry"),
          }}
        />
        <noscript>
          <p className="text-small text-fg-muted">{t("safety.noscript")}</p>
        </noscript>
        <p
          className={cn(
            "text-meta text-pretty",
            suspicious ? "text-warning" : "text-fg-subtle",
          )}
        >
          {suspicious ? t("safety.suspiciousNote") : t("safety.trust")}
        </p>
      </div>

      <div className="mt-10 border-t border-line pt-4">
        {report === "sent" ? (
          <Notice tone="success" live="status">
            {t("safety.report.sent")}
          </Notice>
        ) : (
          <details open={report !== null} className="group">
            <summary className="flex w-fit cursor-pointer list-none items-center gap-1 rounded-chip text-small text-fg-muted hover:text-fg [&::-webkit-details-marker]:hidden">
              <ChevronRight
                aria-hidden
                className="size-4 transition-transform duration-(--motion-fast) group-open:rotate-90"
              />
              {t("safety.report.toggle")}
            </summary>
            <form
              method="post"
              action={`/${locale}/safety/${encodedKey}/report`}
              className="mt-4 flex flex-col gap-4"
            >
              <input type="hidden" name="locale" value={locale} />
              <fieldset className="flex flex-col gap-2">
                <legend className="mb-2 text-small font-medium">
                  {t("safety.report.reason")}
                </legend>
                {reportReasons.map((reason) => (
                  <label
                    key={reason}
                    className="flex cursor-pointer items-center gap-2.5 text-small"
                  >
                    <input
                      type="radio"
                      name="reason"
                      value={reason}
                      required
                      className="size-4 accent-signal"
                    />
                    {t(`safety.report.reasons.${reason}`)}
                  </label>
                ))}
              </fieldset>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="report-details">
                  {t("safety.report.details")}
                </Label>
                <Textarea
                  id="report-details"
                  name="details"
                  rows={3}
                  maxLength={1000}
                />
              </div>
              {report === "invalid" || report === "rate_limited" ? (
                <Notice tone="danger" live="alert">
                  {report === "invalid"
                    ? t("safety.report.invalid")
                    : t("safety.report.rateLimited")}
                </Notice>
              ) : null}
              <button
                type="submit"
                className={cn(buttonVariants(), "self-start")}
              >
                {t("safety.report.submit")}
              </button>
            </form>
          </details>
        )}
      </div>
    </>,
  );
}
