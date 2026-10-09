import { redirect } from "@/i18n/navigation";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { ArrowRight, CalendarX } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default async function SubscriptionCanceledPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{
    scheduled?: string;
  }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("subscription-canceled");
  const { scheduled } = await searchParams;

  if (!scheduled) {
    redirect({ href: "/dashboard", locale });
  }

  const scheduledDate = new Date(scheduled as string);
  const formattedDate = scheduledDate.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="flex w-full pt-12 justify-center px-4 pb-12">
      <div className="w-full max-w-lg space-y-8">
        <div className="space-y-3">
          <CalendarX className="h-8 w-8 text-amber-600" />
          <h1 className="text-2xl font-semibold tracking-tight">
            {t("title")}
          </h1>
          <p className="text-muted-foreground">{t("subtitle")}</p>
        </div>

        <div className="space-y-4">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t("details-heading")}
          </h2>
          <dl className="space-y-0 divide-y divide-border/50">
            <div className="flex justify-between py-3">
              <dt className="text-sm text-muted-foreground">
                {t("effective-date")}
              </dt>
              <dd className="text-sm font-medium">{formattedDate}</dd>
            </div>
            <div className="flex justify-between py-3">
              <dt className="text-sm text-muted-foreground">{t("status")}</dt>
              <dd className="text-sm font-medium text-amber-600">
                {t("pending-cancellation")}
              </dd>
            </div>
            <div className="flex justify-between py-3">
              <dt className="text-sm text-muted-foreground">
                {t("access-until")}
              </dt>
              <dd className="text-sm font-medium">{formattedDate}</dd>
            </div>
          </dl>
        </div>

        <div className="space-y-4">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t("what-happens-heading")}
          </h2>
          <ol className="space-y-3 text-sm">
            <li className="flex gap-3">
              <span className="text-muted-foreground shrink-0">1.</span>
              <span>
                {t.rich("step-1", {
                  date: formattedDate,
                  strong: (chunks) => <strong>{chunks}</strong>,
                })}
              </span>
            </li>
            <li className="flex gap-3">
              <span className="text-muted-foreground shrink-0">2.</span>
              <span>
                {t.rich("step-2", {
                  date: formattedDate,
                  strong: (chunks) => <strong>{chunks}</strong>,
                })}
              </span>
            </li>
            <li className="flex gap-3">
              <span className="text-muted-foreground shrink-0">3.</span>
              <span>{t("step-3")}</span>
            </li>
            <li className="flex gap-3">
              <span className="text-muted-foreground shrink-0">4.</span>
              <span>{t("step-4")}</span>
            </li>
          </ol>
        </div>

        <div className="border-l-2 border-amber-500 bg-amber-50 pl-4 py-3">
          <p className="text-sm font-medium text-amber-900">
            {t("changed-mind")}
          </p>
          <p className="text-sm text-amber-800 mt-1">
            {t("changed-mind-description", { date: formattedDate })}
          </p>
          <Button asChild variant="outline" size="sm" className="mt-3 bg-white">
            <Link href="/dashboard/subscription">{t("view-settings")}</Link>
          </Button>
        </div>

        <div className="flex gap-3">
          <Button asChild>
            <Link href="/dashboard">
              {t("go-to-dashboard")}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>

        <p className="text-xs text-muted-foreground">
          {t.rich("feedback-note", {
            link: (chunks) => (
              <Link
                href="/contact"
                className="font-medium text-foreground underline underline-offset-4"
              >
                {chunks}
              </Link>
            ),
          })}
        </p>
      </div>
    </div>
  );
}
