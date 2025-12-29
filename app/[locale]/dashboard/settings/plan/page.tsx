import { getUserPlan, getPolarPortalUrl } from "@/app/actions/polarActions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Link } from "@/i18n/navigation";
import { getServerSession } from "@/lib/session";
import { cn } from "@/lib/utils";
import { getActiveCodes, getActiveLinks } from "@/utils/fetching-functions";
import {
  SubscriptionsType,
  allowed_links,
  allowed_qr_codes,
} from "@/utils/plan-utils";
import { endOfMonth, format, startOfMonth } from "date-fns";
import { Check, ExternalLink, X } from "lucide-react";
import { setRequestLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { UpcomingInvoice } from "@/components/dashboard/settings/upcoming-invoice";
import { signOutUser } from "@/app/actions/signOut";
import { redirect as NextRedirect } from "next/navigation";
const UsageBar = ({ max, curr }: { max: number; curr: number }) => {
  return (
    <div className="w-full p-0.5 rounded-full shadow bg-muted flex items-center">
      <div
        style={{ width: `${Math.min((curr / max) * 100, 100).toFixed(2)}%` }}
        className="h-2 rounded-full bg-linear-to-r from-0% from-green-600 to-90% to-green-700 flex items-center justify-center text-xs font-semibold text-white"
      ></div>
    </div>
  );
};

export default async function Home({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await getServerSession();
  const user = session?.user;
  if (!user) {
    await signOutUser();
    redirect({ href: "/login", locale });
    return;
  }
  const { plan } = await getUserPlan();
  return (
    <div className="w-full flex flex-col">
      <h1 className="lg:text-xl md:text-lg sm:text-base text-sm font-semibold">
        Plan & Billing
      </h1>
      <h2 className="lg:text-base sm:text-sm text-xs text-muted-foreground">
        Manage your subscription plan, usage, and billing details.
      </h2>
      <Separator className="my-4" />
      <div className="max-w-xl flex flex-col gap-4 w-full my-4">
        <div className="w-full flex flex-col gap-2">
          <Card className="w-full p-0 gap-0!">
            <CardHeader className="p-3 bg-muted rounded-t-xl flex flex-row justify-between items-center">
              <h1 className="sm:text-lg text-base font-bold">
                <span className="capitalize">{plan}</span> plan
              </h1>
              {plan != "pro" && (
                <Button className="h-fit!">
                  <Link href={`/dashboard/subscription`}>Upgrade</Link>
                </Button>
              )}
              {plan == "pro" && (
                <Button className="h-fit!">
                  <Link href={`/dashboard/subscription`}>Change Plan</Link>
                </Button>
              )}
            </CardHeader>
            <CardContent className="p-3! flex flex-col gap-2">
              <h2 className="sm:text-base text-sm font-semibold">
                Included in your plan
              </h2>
              <div className="flex flex-col gap-2 pl-1">
                <div className="flex flex-row items-center justify-start gap-2 text-sm">
                  <Check className="w-3 h-3 shrink-0" />
                  <p>
                    {allowed_links[plan as SubscriptionsType] > 0
                      ? allowed_links[plan as SubscriptionsType]
                      : "Unlimited"}{" "}
                    shortn.at links allowed per month.
                  </p>
                </div>
                <div className="flex flex-row items-center justify-start gap-2 text-sm">
                  <Check className="w-3 h-3 shrink-0" />
                  <p>
                    {allowed_qr_codes[plan as SubscriptionsType] > 0
                      ? allowed_qr_codes[plan as SubscriptionsType]
                      : "Unlimited"}{" "}
                    QR Codes allowed per month.
                  </p>
                </div>
                <div className="flex flex-row items-center justify-start gap-2 text-sm">
                  {plan != "free" ? (
                    <Check className="w-3 h-3 shrink-0" />
                  ) : (
                    <X className="w-3 h-3 shrink-0" />
                  )}
                  <p>Total click and scan count</p>
                </div>
                <div className="flex flex-row items-center justify-start gap-2 text-sm">
                  {plan == "plus" || plan == "pro" ? (
                    <Check className="w-3 h-3 shrink-0" />
                  ) : (
                    <X className="w-3 h-3 shrink-0" />
                  )}
                  <p>Time and Date-Based Analytics</p>
                </div>
                <div className="flex flex-row items-center justify-start gap-2 text-sm">
                  {plan == "plus" || plan == "pro" ? (
                    <Check className="w-3 h-3 shrink-0" />
                  ) : (
                    <X className="w-3 h-3 shrink-0" />
                  )}
                  <p>City level location Insights</p>
                </div>
                <div className="flex flex-row items-center justify-start gap-2 text-sm">
                  {plan == "pro" ? (
                    <Check className="w-3 h-3 shrink-0" />
                  ) : (
                    <X className="w-3 h-3 shrink-0" />
                  )}
                  <p>Device, Browser and OS details</p>
                </div>
                <div className="flex flex-row items-center justify-start gap-2 text-sm">
                  {plan == "pro" ? (
                    <Check className="w-3 h-3 shrink-0" />
                  ) : (
                    <X className="w-3 h-3 shrink-0" />
                  )}
                  <p>Source Tracking</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
        <div className="w-full flex flex-col gap-2">
          <div className="flex flex-col gap-0 items-start">
            <h1 className="sm:text-base text:sm font-semibold">
              Monthly usage
            </h1>
            <p className="text-xs text-muted-foreground">
              {format(startOfMonth(new Date()), "MMM dd")} -{" "}
              {format(endOfMonth(new Date()), "MMM dd")}
            </p>
          </div>
          <Card className="w-full p-3">
            <Tabs defaultValue="shortn">
              <TabsList className="w-full max-w-full!">
                <TabsTrigger value="shortn">Short Links</TabsTrigger>
                <TabsTrigger value="qrs">QR Codes</TabsTrigger>
              </TabsList>
              <TabsContent value="shortn">
                <div className="w-full flex flex-col gap-4">
                  <div className="flex flex-col w-full gap-2">
                    <p className="text-sm font-semibold gap-1">
                      Your short link usage for the month of{" "}
                      {format(new Date(), "MMMM")}{" "}
                      <span
                        className={cn(
                          "text-xs font-medium",
                          (plan == "pro"
                            ? 1000
                            : allowed_links[plan as SubscriptionsType]) <
                            user.links_this_month
                            ? "text-red-600"
                            : "text-muted-foreground",
                        )}
                      >
                        (
                        <span className="font-semibold">
                          {user.links_this_month}
                        </span>
                        /
                        {plan == "pro"
                          ? "Unlimited"
                          : allowed_links[plan as SubscriptionsType]}
                        )
                      </span>
                    </p>
                    <UsageBar
                      max={
                        plan == "pro"
                          ? 1000
                          : allowed_links[plan as SubscriptionsType]
                      }
                      curr={user.links_this_month}
                    />
                    <p className="text-xs font-medium text-left">
                      <span className="font-semibold">
                        Total active links:{" "}
                      </span>
                      {(await getActiveLinks()).total}
                    </p>
                  </div>
                </div>
              </TabsContent>
              <TabsContent value="qrs">
                <div className="w-full flex flex-col gap-4">
                  <div className="flex flex-col w-full gap-2">
                    <p className="text-sm font-semibold gap-1">
                      Your QR Code usage for the month of{" "}
                      {format(new Date(), "MMMM")}{" "}
                      <span
                        className={cn(
                          "text-xs font-medium",
                          (plan == "pro"
                            ? 1000
                            : allowed_qr_codes[plan as SubscriptionsType]) <
                            user.qr_codes_this_month
                            ? "text-red-600"
                            : "text-muted-foreground",
                        )}
                      >
                        (
                        <span className="font-semibold">
                          {user.qr_codes_this_month}
                        </span>
                        /
                        {plan == "pro"
                          ? "Unlimited"
                          : allowed_links[plan as SubscriptionsType]}
                        )
                      </span>
                    </p>
                    <UsageBar
                      max={
                        plan == "pro"
                          ? 1000
                          : allowed_qr_codes[plan as SubscriptionsType]
                      }
                      curr={user.qr_codes_this_month}
                    />
                    <p className="text-xs font-medium text-left">
                      <span className="font-semibold">
                        Total active codes:{" "}
                      </span>
                      {(await getActiveCodes()).total}
                    </p>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </Card>
        </div>
        {plan !== "free" && <UpcomingInvoice />}
        <div className="w-full flex flex-col gap-2">
          <h1 className="sm:text-base text-sm font-semibold">
            Billing Management
          </h1>
          <Card className="w-full p-0 gap-0!">
            <CardContent className="p-4 flex flex-col gap-3">
              <p className="text-sm text-muted-foreground">
                Manage your payment methods, view invoices, update billing
                information, and access your complete billing history through
                our secure billing portal.
              </p>
              <form
                action={async () => {
                  "use server";
                  const result = await getPolarPortalUrl();
                  if (result.success && result.url) {
                    NextRedirect(result.url);
                  }
                }}
              >
                <Button type="submit" className="w-full sm:w-auto">
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Open Billing Portal
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
