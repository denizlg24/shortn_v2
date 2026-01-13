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
      <div className="w-full max-w-2xl space-y-8">
        <div className="space-y-4 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center">
            <CalendarX className="h-16 w-16 text-amber-600" />
          </div>
          <div className="space-y-2">
            <h1 className="text-3xl font-semibold tracking-tight">
              {t("title")}
            </h1>
            <p className="text-lg text-muted-foreground">{t("subtitle")}</p>
          </div>
        </div>

        <div className="space-y-6">
          <div className="space-y-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              {t("details-heading")}
            </h2>
            <div className="rounded-lg border bg-card">
              <div className="divide-y">
                <div className="flex justify-between p-4">
                  <span className="text-sm text-muted-foreground">
                    {t("effective-date")}
                  </span>
                  <span className="text-sm font-semibold">{formattedDate}</span>
                </div>
                <div className="flex justify-between p-4">
                  <span className="text-sm text-muted-foreground">
                    {t("status")}
                  </span>
                  <span className="text-sm font-semibold text-amber-600">
                    {t("pending-cancellation")}
                  </span>
                </div>
                <div className="flex justify-between p-4">
                  <span className="text-sm text-muted-foreground">
                    {t("access-until")}
                  </span>
                  <span className="text-sm font-semibold">{formattedDate}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              {t("what-happens-heading")}
            </h2>
            <div className="rounded-lg border bg-card p-4">
              <ul className="space-y-3 text-sm">
                <li className="flex gap-3">
                  <span className="text-muted-foreground mt-0.5">1.</span>
                  <span>
                    {t.rich("step-1", {
                      date: formattedDate,
                      strong: (chunks) => <strong>{chunks}</strong>,
                    })}
                  </span>
                </li>
                <li className="flex gap-3">
                  <span className="text-muted-foreground mt-0.5">2.</span>
                  <span>
                    {t.rich("step-2", {
                      date: formattedDate,
                      strong: (chunks) => <strong>{chunks}</strong>,
                    })}
                  </span>
                </li>
                <li className="flex gap-3">
                  <span className="text-muted-foreground mt-0.5">3.</span>
                  <span>{t("step-3")}</span>
                </li>
                <li className="flex gap-3">
                  <span className="text-muted-foreground mt-0.5">4.</span>
                  <span>{t("step-4")}</span>
                </li>
              </ul>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
          <h3 className="text-sm font-semibold text-amber-900 mb-2">
            {t("changed-mind")}
          </h3>
          <p className="text-sm text-amber-900 mb-3">
            {t("changed-mind-description", { date: formattedDate })}
          </p>
          <Button asChild variant="outline" size="sm" className="bg-white">
            <Link href="/dashboard/subscription">{t("view-settings")}</Link>
          </Button>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button asChild size="lg">
            <Link href="/dashboard">
              {t("go-to-dashboard")}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>

        <div className="rounded-lg border bg-muted/30 p-4 text-center">
          <p className="text-sm text-muted-foreground">
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
    </div>
  );
}
