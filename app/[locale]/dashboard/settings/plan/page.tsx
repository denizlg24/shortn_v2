import { getUser } from "@/app/actions/userActions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { getActiveCodes, getActiveLinks } from "@/utils/fetching-functions";
import {
  SubscriptionsType,
  allowed_links,
  allowed_qr_codes,
} from "@/utils/plan-utils";
import { endOfMonth, format, startOfMonth } from "date-fns";
import { Check, X } from "lucide-react";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";

const UsageBar = ({ max, curr }: { max: number; curr: number }) => {
  return (
    <div className="w-full p-0.5 rounded-full shadow bg-muted flex items-center">
      <div
        style={{ width: `${Math.min((curr / max) * 100, 100).toFixed(2)}%` }}
        className="h-2 rounded-full bg-gradient-to-r from-0% from-green-600 to-90% to-green-700 flex items-center justify-center text-xs font-semibold text-white"
      >
      </div>
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
  const { user } = await getUser();
  if (!user) {
    notFound();
  }
  return (
    <div className="w-full flex flex-col">
      <h1 className="lg:text-xl md:text-lg sm:text-base text-sm font-semibold">
        Plan details
      </h1>
      <h2 className="lg:text-base sm:text-sm text-xs text-muted-foreground">
        Consult your plan&apos;s usage report and features.
      </h2>
      <Separator className="my-4" />
      <div className="max-w-xl flex flex-col gap-4 w-full my-4">
        <div className="w-full flex flex-col gap-2">
          <Card className="w-full p-0 gap-0!">
            <CardHeader className="p-3 bg-muted rounded-t-xl flex flex-row justify-between items-center">
              <h1 className="sm:text-lg text-base font-bold">
                <span className="capitalize">{user.plan.subscription}</span>{" "}
                plan
              </h1>
              {user.plan.subscription != "pro" && (
                <Button className="h-fit!">
                  <Link href={`/dashboard/subscription`}>Upgrade</Link>
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
                    {allowed_links[
                      user.plan.subscription as SubscriptionsType
                    ] > 0
                      ? allowed_links[
                          user.plan.subscription as SubscriptionsType
                        ]
                      : "Unlimited"}{" "}
                    shortn.at links allowed per month.
                  </p>
                </div>
                <div className="flex flex-row items-center justify-start gap-2 text-sm">
                  <Check className="w-3 h-3 shrink-0" />
                  <p>
                    {allowed_qr_codes[
                      user.plan.subscription as SubscriptionsType
                    ] > 0
                      ? allowed_qr_codes[
                          user.plan.subscription as SubscriptionsType
                        ]
                      : "Unlimited"}{" "}
                    QR Codes allowed per month.
                  </p>
                </div>
                <div className="flex flex-row items-center justify-start gap-2 text-sm">
                  {user.plan.subscription != "free" ? (
                    <Check className="w-3 h-3 shrink-0" />
                  ) : (
                    <X className="w-3 h-3 shrink-0" />
                  )}
                  <p>Total click and scan count</p>
                </div>
                <div className="flex flex-row items-center justify-start gap-2 text-sm">
                  {user.plan.subscription == "plus" ||
                  user.plan.subscription == "pro" ? (
                    <Check className="w-3 h-3 shrink-0" />
                  ) : (
                    <X className="w-3 h-3 shrink-0" />
                  )}
                  <p>Time and Date-Based Analytics</p>
                </div>
                <div className="flex flex-row items-center justify-start gap-2 text-sm">
                  {user.plan.subscription == "plus" ||
                  user.plan.subscription == "pro" ? (
                    <Check className="w-3 h-3 shrink-0" />
                  ) : (
                    <X className="w-3 h-3 shrink-0" />
                  )}
                  <p>City level location Insights</p>
                </div>
                <div className="flex flex-row items-center justify-start gap-2 text-sm">
                  {user.plan.subscription == "pro" ? (
                    <Check className="w-3 h-3 shrink-0" />
                  ) : (
                    <X className="w-3 h-3 shrink-0" />
                  )}
                  <p>Device, Browser and OS details</p>
                </div>
                <div className="flex flex-row items-center justify-start gap-2 text-sm">
                  {user.plan.subscription == "pro" ? (
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
                {(user.plan.subscription as SubscriptionsType) == "pro" ? (
                  <div></div>
                ) : (
                  <div className="w-full flex flex-col gap-4">
                    <div className="flex flex-col w-full gap-2">
                      <p className="text-sm font-semibold gap-1">
                        Your short link usage for the month of{" "}
                        {format(new Date(), "MMMM")}{" "}
                        <span
                          className={cn(
                            "text-xs font-medium",
                            allowed_links[
                              user.plan.subscription as SubscriptionsType
                            ] < user.links_this_month
                              ? "text-red-600"
                              : "text-muted-foreground"
                          )}
                        >
                          (
                          <span className="font-semibold">
                            {user.links_this_month}
                          </span>
                          /
                          {
                            allowed_links[
                              user.plan.subscription as SubscriptionsType
                            ]
                          }
                          )
                        </span>
                      </p>
                      <UsageBar
                        max={
                          allowed_links[
                            user.plan.subscription as SubscriptionsType
                          ]
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
                )}
              </TabsContent>
              <TabsContent value="qrs">
                {(user.plan.subscription as SubscriptionsType) == "pro" ? (
                  <div></div>
                ) : (
                  <div className="w-full flex flex-col gap-4">
                    <div className="flex flex-col w-full gap-2">
                      <p className="text-sm font-semibold gap-1">
                        Your QR Code usage for the month of{" "}
                        {format(new Date(), "MMMM")}{" "}
                        <span
                          className={cn(
                            "text-xs font-medium",
                            allowed_qr_codes[
                              user.plan.subscription as SubscriptionsType
                            ] < user.qr_codes_this_month
                              ? "text-red-600"
                              : "text-muted-foreground"
                          )}
                        >
                          (
                          <span className="font-semibold">
                            {user.qr_codes_this_month}
                          </span>
                          /
                          {
                            allowed_qr_codes[
                              user.plan.subscription as SubscriptionsType
                            ]
                          }
                          )
                        </span>
                      </p>
                      <UsageBar
                        max={
                          allowed_qr_codes[
                            user.plan.subscription as SubscriptionsType
                          ]
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
                )}
              </TabsContent>
            </Tabs>
          </Card>
        </div>
      </div>
    </div>
  );
}
