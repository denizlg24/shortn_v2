"use client";
import { createQrCode } from "@/app/actions/qrCodeActions";
import { createShortn } from "@/app/actions/linkActions";
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
import { useUser } from "@/utils/UserContext";
import { zodResolver } from "@hookform/resolvers/zod";
import { LinkIcon, Loader2, QrCode, XCircle } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import z from "zod";

const urlFormSchema = z.object({
  destination: z
    .string()
    .min(1, 'We\'ll need a valid URL, like "yourbrnd.co/niceurl"')
    .url('We\'ll need a valid URL, like "yourbrnd.co/niceurl"'),
});

export const getLinksLeft = (
  subscription: string,
  thisMonth: number,
  qr?: boolean,
  className?: string,
) => {
  const allowedLinks = {
    free: 3,
    basic: 25,
    plus: 50,
  };

  const linksLeft =
    subscription != "pro"
      ? allowedLinks[subscription as "free" | "basic" | "plus"] - thisMonth
      : undefined;

  if (subscription == "pro") {
    return (
      <p className={cn("text-sm font-semibold", className)}>
        You can create <span className="font-bold">UNLIMITED</span>{" "}
        {qr ? "QR Codes" : "Shortn Links"} this month.
      </p>
    );
  }

  if (linksLeft == undefined) {
    return (
      <p className={cn("text-sm font-semibold", className)}>
        You can create{" "}
        <span className="bg-accent animate-pulse text-accent rounded">00</span>{" "}
        more {qr ? "QR Codes" : "Shortn Links"} this month.
      </p>
    );
  }
  if (linksLeft > 0) {
    return (
      <p className={cn("text-sm font-semibold", className)}>
        You can create <span className="font-bold">{linksLeft}</span> more{" "}
        {qr ? "QR Codes" : "Shortn Links"} this month.
      </p>
    );
  }
  if (linksLeft < 0) {
    return (
      <p className={cn("text-sm font-semibold", className)}>
        You can&apos;t create any more {qr ? "QR Codes" : "Shortn Links"} this
        month.{" "}
        <Button asChild className="h-fit px-4 py-1 rounded w-fit">
          <Link href={`/dashboard/subscription`}>Upgrade</Link>
        </Button>
      </p>
    );
  }
};

export const QuickCreate = ({ className }: { className?: string }) => {
  const { user } = useUser();

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
            Quick Create
          </h1>
          <TabsList className="rounded-full! sm:w-auto w-full">
            <TabsTrigger
              className="font-semibold flex flex-row items-center gap-1 p-4! rounded-full"
              value="link"
            >
              <LinkIcon />
              Short Link
            </TabsTrigger>
            <TabsTrigger
              className="font-semibold flex flex-row items-center gap-1 p-4! rounded-full"
              value="qrcode"
            >
              <QrCode />
              QR Code
            </TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="link" asChild>
          <div className="w-full flex flex-col gap-1 justify-between">
            {getLinksLeft(
              user?.plan.subscription ?? "free",
              user?.links_this_month ?? 0,
            )}
            <Form {...urlForm}>
              <form
                onSubmit={urlForm.handleSubmit(async (data) => {
                  setLinkLoading(true);
                  const response = await createShortn({
                    longUrl: data.destination,
                  });
                  if (response.success && response.data) {
                    router.push(
                      `/dashboard/links/${response.data.shortUrl}/details`,
                    );
                  } else if (response.existingUrl) {
                    toast(
                      <div className="w-full flex flex-col gap-2">
                        <div className="flex flex-row items-center justify-start gap-2">
                          <XCircle className="text-destructive" />
                          <p className="text-lg font-bold">Duplicate Shortn.</p>
                        </div>
                        <div className="w-full">
                          <p className="text-sm">
                            You have already created a shortened url with that
                            custom back-half.{" "}
                            <Link
                              onClick={async () => {
                                toast.dismiss("duplicate-shortn-toast");
                              }}
                              href={`/dashboard/links/${response.existingUrl}/details`}
                              className="underline text-primary font-semibold"
                            >
                              View details.
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
                          message:
                            "There was an unexpected error while creating your short url",
                        });
                        break;
                      case "no-user":
                        urlForm.setError("destination", {
                          type: "manual",
                          message: "You are not authenticated",
                        });
                        break;
                      case "plan-limit":
                        urlForm.setError("destination", {
                          type: "manual",
                          message:
                            "You have exceeded your plan's monthly link limit.",
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
                      <FormLabel>Enter your destination URL</FormLabel>
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
                      <Loader2 className="animate-spin" /> Creating link...
                    </>
                  ) : (
                    <>Create your Shortn</>
                  )}
                </Button>
              </form>
            </Form>
          </div>
        </TabsContent>
        <TabsContent value="qrcode" asChild>
          <div className="w-full flex flex-col gap-1 justify-between">
            {getLinksLeft(
              user?.plan.subscription ?? "free",
              user?.qr_codes_this_month ?? 0,
              true,
            )}
            <Form {...qrCodeForm}>
              <form
                onSubmit={qrCodeForm.handleSubmit(async (data) => {
                  setQrCodeLoading(true);
                  const response = await createQrCode({
                    longUrl: data.destination,
                  });
                  if (response.success && response.data) {
                    router.push(
                      `/dashboard/qr-codes/${response.data.qrCodeId}/details`,
                    );
                  } else if (response.message) {
                    switch (response.message) {
                      case "server-error":
                        qrCodeForm.setError("destination", {
                          type: "manual",
                          message:
                            "There was an unexpected error while creating your QR Code",
                        });
                        break;
                      case "no-user":
                        qrCodeForm.setError("destination", {
                          type: "manual",
                          message: "You are not authenticated",
                        });
                        break;
                      case "plan-limit":
                        qrCodeForm.setError("destination", {
                          type: "manual",
                          message:
                            "You have exceeded your plan's monthly QR Code limit.",
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
                      <FormLabel>Enter your destination URL</FormLabel>
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
                      <Loader2 className="animate-spin" /> Creating QR Code...
                    </>
                  ) : (
                    <>Create your QR Code</>
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
