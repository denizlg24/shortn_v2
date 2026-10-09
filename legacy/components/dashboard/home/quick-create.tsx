"use client";
import { createQrCode } from "@/app/actions/qrCodeActions";
import { createShortn } from "@/app/actions/linkActions";
import { getCurrentUsage, UsageData } from "@/app/actions/usageActions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Link, useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { zodResolver } from "@hookform/resolvers/zod";
import { LinkIcon, Loader2, QrCode, XCircle } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Skeleton } from "@/components/ui/skeleton";
import { usePlan } from "@/hooks/use-plan";
import { useTranslations } from "next-intl";

const useUrlFormSchema = () => {
  const t = useTranslations("quick-create.validation");
  return z.object({
    destination: z.string().min(1, t("invalid-url")).url(t("invalid-url")),
  });
};

export const LinksLeftDisplay = ({
  subscription,
  thisMonth,
  qr,
  className,
}: {
  subscription: string;
  thisMonth: number;
  qr?: boolean;
  className?: string;
}) => {
  const t = useTranslations("quick-create");
  const allowedLinks = {
    free: 3,
    basic: 25,
    plus: 50,
  };

  const linksLeft =
    subscription != "pro"
      ? allowedLinks[subscription as "free" | "basic" | "plus"] - thisMonth
      : undefined;

  const typeLabel = qr ? t("qr-codes") : t("shortn-links");

  if (subscription == "pro") {
    return (
      <p className={cn("text-sm font-semibold", className)}>
        You can create <span className="font-bold">{t("unlimited")}</span>{" "}
        {typeLabel} this month.
      </p>
    );
  }

  if (linksLeft == undefined) {
    return (
      <p className={cn("text-sm font-semibold", className)}>
        You can create{" "}
        <span className="bg-accent animate-pulse text-accent rounded">00</span>{" "}
        more {typeLabel} this month.
      </p>
    );
  }
  if (linksLeft > 0) {
    return (
      <p className={cn("text-sm font-semibold", className)}>
        You can create <span className="font-bold">{linksLeft}</span> more{" "}
        {typeLabel} this month.
      </p>
    );
  }
  if (linksLeft <= 0) {
    return (
      <p className={cn("text-sm font-semibold", className)}>
        You can&apos;t create any more {typeLabel} this month.{" "}
        <Button asChild className="h-fit px-4 py-1 rounded w-fit">
          <Link href={`/dashboard/subscription`}>{t("upgrade")}</Link>
        </Button>
      </p>
    );
  }
  return null;
};

export function getLinksLeft(
  subscription: string,
  thisMonth: number,
  qr?: boolean,
  className?: string,
) {
  return (
    <LinksLeftDisplay
      subscription={subscription}
      thisMonth={thisMonth}
      qr={qr}
      className={className}
    />
  );
}

export const QuickCreate = ({ className }: { className?: string }) => {
  const { plan } = usePlan();
  const t = useTranslations("quick-create");
  const tToast = useTranslations("quick-create.toast");
  const urlFormSchema = useUrlFormSchema();

  const [usage, setUsage] = useState<UsageData | null>(null);
  const [usageLoading, setUsageLoading] = useState(true);

  const fetchUsage = useCallback(async () => {
    setUsageLoading(true);
    const result = await getCurrentUsage();
    if (result.success && result.data) {
      setUsage(result.data);
    }
    setUsageLoading(false);
  }, []);

  useEffect(() => {
    void fetchUsage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const urlForm = useForm<z.infer<typeof urlFormSchema>>({
    resolver: zodResolver(urlFormSchema),
    defaultValues: {
      destination: "",
    },
  });

  const qrCodeForm = useForm<z.infer<typeof urlFormSchema>>({
    resolver: zodResolver(urlFormSchema),
    defaultValues: {
      destination: "",
    },
  });

  const router = useRouter();
  const [linkLoading, setLinkLoading] = useState(false);
  const [qrCodeLoading, setQrCodeLoading] = useState(false);

  return (
    <Card
      className={cn("p-4 pb-6 w-full flex flex-col justify-between", className)}
    >
      <Tabs defaultValue="link" className="w-full col-span-full h-full">
        <div className="w-full flex sm:flex-row flex-col items-center justify-between gap-2">
          <h1 className="col-span-1 lg:text-2xl md:text-xl sm:text-lg text-base font-bold text-left sm:w-auto w-full">
            {t("title")}
          </h1>
          <TabsList className="rounded-full! sm:w-auto w-full">
            <TabsTrigger
              className="font-semibold flex flex-row items-center gap-1 p-4! rounded-full"
              value="link"
            >
              <LinkIcon />
              {t("short-link")}
            </TabsTrigger>
            <TabsTrigger
              className="font-semibold flex flex-row items-center gap-1 p-4! rounded-full"
              value="qrcode"
            >
              <QrCode />
              {t("qr-code")}
            </TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="link" asChild>
          <div className="w-full flex flex-col gap-1 justify-between">
            {usageLoading ? (
              <Skeleton className="h-5 w-64 mb-1" />
            ) : (
              <LinksLeftDisplay
                subscription={plan ?? "free"}
                thisMonth={usage?.links.consumed ?? 0}
              />
            )}

            <Form {...urlForm}>
              <form
                onSubmit={urlForm.handleSubmit(async (data) => {
                  setLinkLoading(true);
                  const response = await createShortn({
                    longUrl: data.destination,
                  });
                  if (response.success && response.data) {
                    await fetchUsage();
                    router.push(
                      `/dashboard/links/${response.data.shortUrl}/details`,
                    );
                  } else if (response.existingUrl) {
                    toast(
                      <div className="w-full flex flex-col gap-2">
                        <div className="flex flex-row items-center justify-start gap-2">
                          <XCircle className="text-destructive" />
                          <p className="text-lg font-bold">
                            {tToast("duplicate")}
                          </p>
                        </div>
                        <div className="w-full">
                          <p className="text-sm">
                            {tToast("duplicate-desc")}{" "}
                            <Link
                              onClick={async () => {
                                toast.dismiss("duplicate-shortn-toast");
                              }}
                              href={`/dashboard/links/${response.existingUrl}/details`}
                              className="underline text-primary font-semibold"
                            >
                              {tToast("view-details")}
                            </Link>
                          </p>
                        </div>
                      </div>,
                      { id: "duplicate-shortn-toast" },
                    );
                    setLinkLoading(false);
                  } else if (response.message) {
                    switch (response.message) {
                      case "server-error":
                        urlForm.setError("destination", {
                          type: "manual",
                          message: tToast("error"),
                        });
                        break;
                      case "no-user":
                        urlForm.setError("destination", {
                          type: "manual",
                          message: tToast("not-authenticated"),
                        });
                        break;
                      case "plan-limit":
                        urlForm.setError("destination", {
                          type: "manual",
                          message: tToast("link-limit"),
                        });
                        break;
                      default:
                        break;
                    }
                    setLinkLoading(false);
                  }
                })}
                className="w-full sm:grid flex flex-col grid-cols-6 gap-4 items-end pb-2 sm:mt-0 mt-6!"
              >
                <FormField
                  control={urlForm.control}
                  name="destination"
                  render={({ field }) => (
                    <FormItem className="col-span-4 sm:relative w-full">
                      <FormLabel>{t("destination-placeholder")}</FormLabel>
                      <FormControl>
                        <Input className="w-full" placeholder="" {...field} />
                      </FormControl>
                      <FormMessage className="sm:absolute top-full mt-1" />
                    </FormItem>
                  )}
                />
                <Button
                  disabled={linkLoading}
                  type="submit"
                  className="col-span-2 w-full"
                >
                  {linkLoading ? (
                    <>
                      <Loader2 className="animate-spin" /> {t("creating-link")}
                    </>
                  ) : (
                    <>{t("create-shortn")}</>
                  )}
                </Button>
              </form>
            </Form>
          </div>
        </TabsContent>
        <TabsContent value="qrcode" asChild>
          <div className="w-full flex flex-col gap-1 justify-between">
            {usageLoading ? (
              <Skeleton className="h-5 w-64 mb-1" />
            ) : (
              <LinksLeftDisplay
                subscription={plan ?? "free"}
                thisMonth={usage?.qrCodes.consumed ?? 0}
                qr
              />
            )}

            <Form {...qrCodeForm}>
              <form
                onSubmit={qrCodeForm.handleSubmit(async (data) => {
                  setQrCodeLoading(true);
                  const response = await createQrCode({
                    longUrl: data.destination,
                  });
                  if (response.success && response.data) {
                    await fetchUsage();
                    router.push(
                      `/dashboard/qr-codes/${response.data.qrCodeId}/details`,
                    );
                  } else if (response.message) {
                    switch (response.message) {
                      case "server-error":
                        qrCodeForm.setError("destination", {
                          type: "manual",
                          message: tToast("qr-error"),
                        });
                        break;
                      case "no-user":
                        qrCodeForm.setError("destination", {
                          type: "manual",
                          message: tToast("not-authenticated"),
                        });
                        break;
                      case "plan-limit":
                        qrCodeForm.setError("destination", {
                          type: "manual",
                          message: tToast("qr-limit"),
                        });
                        break;
                      default:
                        break;
                    }
                    setQrCodeLoading(false);
                  }
                })}
                className="w-full sm:grid flex flex-col grid-cols-6 gap-4 items-end pb-2 sm:mt-0 mt-6!"
              >
                <FormField
                  control={qrCodeForm.control}
                  name="destination"
                  render={({ field }) => (
                    <FormItem className="col-span-4 sm:relative w-full">
                      <FormLabel>{t("destination-placeholder")}</FormLabel>
                      <FormControl>
                        <Input className="w-full" placeholder="" {...field} />
                      </FormControl>
                      <FormMessage className="sm:absolute top-full mt-1" />
                    </FormItem>
                  )}
                />
                <Button
                  disabled={qrCodeLoading}
                  type="submit"
                  className="col-span-2 w-full"
                >
                  {qrCodeLoading ? (
                    <>
                      <Loader2 className="animate-spin" /> {t("creating-qr")}
                    </>
                  ) : (
                    <>{t("create-qr")}</>
                  )}
                </Button>
              </form>
            </Form>
          </div>
        </TabsContent>
      </Tabs>
    </Card>
  );
};
