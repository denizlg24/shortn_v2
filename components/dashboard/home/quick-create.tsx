"use client";
import { createShortn } from "@/app/actions/createShortn";
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
import { Skeleton } from "@/components/ui/skeleton";
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

export const QuickCreate = ({ className }: { className?: string }) => {
  const { user } = useUser();
  const allowedLinks = {
    free: 3,
    basic: 25,
    plus: 50,
  };
  const linksLeft =
    user?.plan.subscription && user.plan.subscription != "pro"
      ? allowedLinks[user.plan.subscription as "free" | "basic" | "plus"] -
        (user.links_this_month ?? 0)
      : undefined;

  const urlForm = useForm<z.infer<typeof urlFormSchema>>({
    resolver: zodResolver(urlFormSchema),
    defaultValues: {
      destination: "",
    },
  });

  const router = useRouter();

  const [linkLoading, setLinkLoading] = useState(false);
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
            {linksLeft == undefined ? (
              <div className="text-sm font-semibold w-full flex flex-row items-center gap-1">
                <p>You can create </p>
                <Skeleton className="w-3 h-3" />
                <p> more short links this month.</p>
              </div>
            ) : linksLeft > 0 ? (
              <p className="text-sm font-semibold  gap-1 flex flex-row items-center">
                You can create <span className="font-bold">{linksLeft}</span>{" "}
                more short links this month.
              </p>
            ) : (
              <div className="text-sm font-semibold w-full flex flex-row items-center gap-2">
                <p>You can't create any more short links this month.</p>
                <Button asChild className="h-fit px-4 py-1 rounded w-fit">
                  <Link
                    href={`/dashboard/${user?.sub.split("|")[1]}/subscription`}
                  >
                    Upgrade
                  </Link>
                </Button>
              </div>
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
                      `/dashboard/${user?.sub.split("|")[1]}/links/${
                        response.data.shortUrl
                      }/details`
                    );
                  } else if (response.existingUrl) {
                    const existingToast = toast(
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
                                toast.dismiss(existingToast);
                              }}
                              href={`/dashboard/${
                                user?.sub.split("|")[1]
                              }/links/${response.existingUrl}/details`}
                              className="underline text-primary font-semibold"
                            >
                              View details.
                            </Link>
                          </p>
                        </div>
                      </div>
                    );
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
                  }
                  setLinkLoading(false);
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
                        <Input
                          className="bg-background w-full"
                          placeholder=""
                          {...field}
                        />
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
          <div
            className={cn(
              "w-full flex flex-col gap-1",
              user?.plan.subscription != "pro"
                ? "justify-between"
                : "justify-end"
            )}
          >
            {user?.plan.subscription != "pro" && (
              <div className="flex flex-row flex-wrap gap-2 w-full">
                <p>This is a PRO only feature.</p>
                <Button asChild className="h-fit px-4 py-1 rounded w-fit">
                  <Link
                    href={`/dashboard/${user?.sub.split("|")[1]}/subscription`}
                  >
                    Upgrade
                  </Link>
                </Button>
              </div>
            )}
            <div className="w-full flex flex-col gap-1 ">
              <p>Enter your destination URL</p>
              <div className="w-full sm:grid flex flex-col grid-cols-6 gap-4">
                <Input
                  disabled={user?.plan.subscription != "pro"}
                  className="col-span-4"
                  type="text"
                  placeholder="https://myexample.com/longurl"
                />
                <Button
                  disabled={user?.plan.subscription != "pro"}
                  className="col-span-2"
                >
                  Create your QR Code
                </Button>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </Card>
  );
};
