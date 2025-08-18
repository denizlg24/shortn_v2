"use client";

import { attachQRToShortn, createShortn } from "@/app/actions/linkActions";
import { createQrCode } from "@/app/actions/qrCodeActions";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { StyledQRCode } from "@/components/ui/styled-qr-code";
import { Switch } from "@/components/ui/switch";
import { Link, useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { useUser } from "@/utils/UserContext";
import { zodResolver } from "@hookform/resolvers/zod";
import { Infinity, Loader2, LockIcon } from "lucide-react";
import { Options } from "qr-code-styling";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { getLinksLeft } from "../../home/quick-create";

const linkFormSchema = z.object({
  destination: z
    .string()
    .min(1, 'We\'ll need a valid URL, like "yourbrnd.co/niceurl"')
    .url('We\'ll need a valid URL, like "yourbrnd.co/niceurl"'),
  title: z.string().optional(),
  customCode: z
    .union([
      z
        .string()
        .min(3, "Back-half must be at least 3 characters long")
        .max(52, "Back-half can't be longer than 52 characters")
        .regex(
          /^[a-zA-Z0-9_-]+$/,
          "Back-half can only contain letters, numbers, dashes (-), and underscores (_)"
        ),
      z.literal(""),
    ])
    .optional(),
});

export const LinksCreate = () => {
  const session = useUser();
  const router = useRouter();
  const [presetChosen, setPresetChosen] = useState<number | undefined>(0);

  const [creating, setCreating] = useState(false);
  const [options, setOptions] = useState<Partial<Options>>({
    type: "svg",
    data: "https://shortn.at",
    dotsOptions: {
      color: "#000",
      type: "square",
    },
    cornersSquareOptions: {
      type: "rounded",
    },
    cornersDotOptions: {
      type: "rounded",
    },
    backgroundOptions: {
      color: "#ffffff",
    },
    imageOptions: {
      crossOrigin: "anonymous",
    },
    qrOptions: {
      errorCorrectionLevel: "M",
    },
  });
  const allowedLinks = {
    free: 3,
    basic: 25,
    plus: 50,
  };

  const qrCodesLeft =
    session.user?.plan.subscription && session.user.plan.subscription != "pro"
      ? allowedLinks[
          session.user.plan.subscription as "free" | "basic" | "plus"
        ] - (session.user.qr_codes_this_month ?? 0)
      : undefined;

  const linkForm = useForm<z.infer<typeof linkFormSchema>>({
    resolver: zodResolver(linkFormSchema),
    defaultValues: {
      destination: "",
      title: "",
      customCode: "",
    },
  });

  const [addQR, setAddQR] = useState(false);

  return (
    <div className="w-full flex flex-col gap-6 items-start col-span-full">
      <div className="flex flex-col gap-1 w-full items-start">
        <h1 className="font-bold lg:text-3xl md:text-2xl sm:text-xl text-lg">
          Create a new short link
        </h1>
        {getLinksLeft(
          session.user?.plan.subscription ?? "free",
          session.user?.links_this_month ?? 0,
          false,
          "text-xs"
        )}
      </div>
      <div className="rounded bg-background lg:p-6 md:p-4 p-3 w-full flex flex-col gap-4">
        <Form {...linkForm}>
          <form className="w-full flex flex-col gap-4">
            <FormField
              control={linkForm.control}
              name="destination"
              render={({ field }) => (
                <FormItem className="w-full">
                  <FormLabel>Destination</FormLabel>
                  <FormControl>
                    <Input className="w-full" placeholder="" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={linkForm.control}
              name="title"
              render={({ field }) => (
                <FormItem className="w-full">
                  <FormLabel>Tittle (optional)</FormLabel>
                  <FormControl>
                    <Input className="w-full" placeholder="" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <h2 className="font-semibold lg:text-xl sm:text-lg text-base">
              Short Link
            </h2>
            <div className="w-full flex flex-row items-end justify-center gap-2 -mt-2">
              <div className="w-full grow flex flex-col items-start gap-2">
                <p className="sm:text-sm text-xs font-semibold">Domain</p>
                <Input
                  disabled
                  className="w-full"
                  value={process.env.NEXT_PUBLIC_APP_URL?.split("//")[1]}
                />
              </div>
              <div className="h-9 text-sm flex items-center justify-center">
                <p>/</p>
              </div>
              <div className="w-full grow flex flex-col items-start gap-2">
                <div className="flex flex-row items-center gap-1">
                  <p className="sm:text-sm text-xs font-semibold">
                    Custom back-half (optional)
                  </p>
                  {session.user?.plan.subscription != "pro" && (
                    <HoverCard>
                      <HoverCardTrigger asChild>
                        <Button className="p-0! h-fit!" variant={"link"}>
                          <LockIcon className="w-3! h-3!" />
                        </Button>
                      </HoverCardTrigger>
                      <HoverCardContent asChild>
                        <div className="w-full max-w-[300px] p-2! px-3! rounded bg-primary text-primary-foreground flex flex-col gap-0 items-start text-xs cursor-help">
                          <p className="text-sm font-bold">
                            Unlock custom codes
                          </p>
                          <div className="w-full flex flex-row gap-1 items-center">
                            <Link
                              href={`/dashboard/subscription`}
                              className="underline hover:cursor-pointer"
                            >
                              Upgrade
                            </Link>
                            <p>to access link stats.</p>
                          </div>
                        </div>
                      </HoverCardContent>
                    </HoverCard>
                  )}
                </div>
                <FormField
                  control={linkForm.control}
                  name="customCode"
                  render={({ field }) => (
                    <FormItem className="w-full relative">
                      <FormControl>
                        <Input
                          disabled={session.user?.plan.subscription != "pro"}
                          className="w-full"
                          placeholder=""
                          {...field}
                        />
                      </FormControl>
                      <FormMessage className="absolute -bottom-6" />
                    </FormItem>
                  )}
                />
              </div>
            </div>
          </form>
        </Form>
        <h2 className="font-semibold lg:text-xl sm:text-lg text-base">
          Ways to share
        </h2>
        <div className="flex flex-row w-full justify-between items-start">
          <div className="flex flex-col gap-1 items-start w-full max-w-3xs">
            <p className="font-semibold sm:text-sm text-xs">QR Code</p>
            <p className="text-muted-foreground sm:text-sm text-xs">
              Generate a QR Code to share anywhere people can see it
            </p>
          </div>
          <div className="flex flex-row gap-2 items-center">
            {session?.user?.plan.subscription == "pro" ? (
              <div className="text-muted-foreground sm:text-sm text-xs w-full flex flex-row items-center gap-1 border-b border-dashed">
                <Infinity className="min-w-3! w-3! h-3!" />
                <p>left</p>
              </div>
            ) : qrCodesLeft == undefined ? (
              <div className="text-muted-foreground sm:text-sm text-xs w-full flex flex-row items-center gap-1 border-b border-dashed">
                <Skeleton className="w-3 h-3" />
                <p>left</p>
              </div>
            ) : qrCodesLeft > 0 ? (
              <p className="text-muted-foreground sm:text-sm text-xs gap-1 flex flex-row items-center border-b border-dashed">
                <span className="font-semibold">{qrCodesLeft}</span> left
              </p>
            ) : (
              <></>
            )}
            <Switch
              checked={addQR}
              onCheckedChange={setAddQR}
              id="create-link"
            />
          </div>
        </div>
        {addQR && (
          <div className="w-full md:p-4 sm:p-3 p-2 bg-muted flex sm:flex-row flex-col sm:items-start items-center">
            <div className="w-full flex flex-col items-start gap-6">
              <div className="flex flex-col items-start gap-1">
                <p className="lg:text-base text-sm font-semibold">
                  Choose a color
                </p>
                <div className="w-full grid grid-cols-6 gap-2 max-w-xs">
                  <Button
                    variant={"outline"}
                    onClick={() => {
                      setPresetChosen(0);
                      setOptions((prev) => ({
                        ...prev,
                        dotsOptions: {
                          ...prev.dotsOptions,
                          color: "#000",
                        },
                        backgroundOptions: {
                          ...prev.backgroundOptions,
                          color: "#ffffff",
                        },
                      }));
                    }}
                    className={cn(
                      "col-span-1 w-10 h-10 p-0.5! py-0.5! rounded-full!",
                      presetChosen == 0 && "border-2 border-primary"
                    )}
                  >
                    <div className="w-full h-full rounded-full bg-[#000]"></div>
                  </Button>
                  <Button
                    variant={"outline"}
                    onClick={() => {
                      setPresetChosen(1);
                      setOptions((prev) => ({
                        ...prev,
                        dotsOptions: {
                          ...prev.dotsOptions,
                          color: "#DE3121",
                        },
                        backgroundOptions: {
                          ...prev.backgroundOptions,
                          color: "#ffffff",
                        },
                      }));
                    }}
                    className={cn(
                      "col-span-1 w-10 h-10 p-0.5! py-0.5! rounded-full!",
                      presetChosen == 1 && "border-2 border-primary"
                    )}
                  >
                    <div className="w-full h-full rounded-full bg-[#DE3121]"></div>
                  </Button>
                  <Button
                    variant={"outline"}
                    onClick={() => {
                      setPresetChosen(2);
                      setOptions((prev) => ({
                        ...prev,
                        dotsOptions: {
                          ...prev.dotsOptions,
                          color: "#EF8000",
                        },
                        backgroundOptions: {
                          ...prev.backgroundOptions,
                          color: "#ffffff",
                        },
                      }));
                    }}
                    className={cn(
                      "col-span-1 w-10 h-10 p-0.5! py-0.5! rounded-full!",
                      presetChosen == 2 && "border-2 border-primary"
                    )}
                  >
                    <div className="w-full h-full rounded-full bg-[#EF8000]"></div>
                  </Button>
                  <Button
                    variant={"outline"}
                    onClick={() => {
                      setPresetChosen(3);
                      setOptions((prev) => ({
                        ...prev,
                        dotsOptions: {
                          ...prev.dotsOptions,
                          color: "#198639",
                        },
                        backgroundOptions: {
                          ...prev.backgroundOptions,
                          color: "#ffffff",
                        },
                      }));
                    }}
                    className={cn(
                      "col-span-1 w-10 h-10 p-0.5! py-0.5! rounded-full!",
                      presetChosen == 3 && "border-2 border-primary"
                    )}
                  >
                    <div className="w-full h-full rounded-full bg-[#198639]"></div>
                  </Button>
                  <Button
                    variant={"outline"}
                    onClick={() => {
                      setPresetChosen(4);
                      setOptions((prev) => ({
                        ...prev,
                        dotsOptions: {
                          ...prev.dotsOptions,
                          color: "#229CE0",
                        },
                        backgroundOptions: {
                          ...prev.backgroundOptions,
                          color: "#ffffff",
                        },
                      }));
                    }}
                    className={cn(
                      "col-span-1 w-10 h-10 p-0.5! py-0.5! rounded-full!",
                      presetChosen == 4 && "border-2 border-primary"
                    )}
                  >
                    <div className="w-full h-full rounded-full bg-[#229CE0]"></div>
                  </Button>
                  <Button
                    variant={"outline"}
                    onClick={() => {
                      setPresetChosen(5);
                      setOptions((prev) => ({
                        ...prev,
                        dotsOptions: {
                          ...prev.dotsOptions,
                          color: "#6B52D1",
                        },
                        backgroundOptions: {
                          ...prev.backgroundOptions,
                          color: "#ffffff",
                        },
                      }));
                    }}
                    className={cn(
                      "col-span-1 w-10 h-10 p-0.5! py-0.5! rounded-full!",
                      presetChosen == 5 && "border-2 border-primary"
                    )}
                  >
                    <div className="w-full h-full rounded-full bg-[#6B52D1]"></div>
                  </Button>
                </div>
              </div>
            </div>
            <div className="w-full bg-background max-w-xs lg:flex hidden flex-col gap-4 p-4 items-center text-center">
              <p className="font-semibold text-muted-foreground lg:text-lg text-base">
                Preview
              </p>
              <div className="w-full border h-auto max-w-32 aspect-square bg-background p-1 flex flex-col">
                <StyledQRCode className="w-full" options={options} />
              </div>
              <p className="text-xs text-muted-foreground">
                More customizations are available after creating.
              </p>
            </div>
          </div>
        )}
        <div className="flex flex-row items-center justify-between mt-4">
          <Button onClick={() => {}} variant={"secondary"}>
            Cancel
          </Button>
          <Button
            onClick={linkForm.handleSubmit(async (data) => {
              setCreating(true);
              if (addQR) {
                const firstLinkResponse = await createShortn({
                  longUrl: data.destination,
                  title: data.title,
                  customCode: data.customCode,
                });
                if (!firstLinkResponse.success) {
                  switch (firstLinkResponse.message) {
                    case "duplicate":
                      linkForm.setError("customCode", {
                        type: "manual",
                        message:
                          "You already have a shortn link with that custom back-half.",
                      });
                      setCreating(false);
                      return;
                    case "no-user":
                      linkForm.setError("destination", {
                        type: "manual",
                        message: "User session error.",
                      });
                      setCreating(false);
                      return;
                    case "custom-restricted":
                      linkForm.setError("customCode", {
                        type: "manual",
                        message:
                          "Custom back-halves are restricted to pro accounts.",
                      });
                      setCreating(false);
                      return;
                    case "plan-limit":
                      linkForm.setError("destination", {
                        type: "manual",
                        message: "You have reached your plan's link limit.",
                      });
                      setCreating(false);
                      return;
                    default:
                      linkForm.setError("destination", {
                        type: "manual",
                        message: "There was a problem creating your QR Code.",
                      });
                      setCreating(false);
                      return;
                  }
                }
                if (firstLinkResponse.success && firstLinkResponse.data) {
                  const qrCodeResponse = await createQrCode({
                    longUrl: data.destination,
                    title: data.title,
                    attachedUrl: firstLinkResponse.data.shortUrl,
                    options,
                  });
                  if (!qrCodeResponse.success) {
                    switch (qrCodeResponse.message) {
                      case "no-user":
                        linkForm.setError("destination", {
                          type: "manual",
                          message: "User session error.",
                        });
                        setCreating(false);
                        return;
                      case "plan-limit":
                        linkForm.setError("destination", {
                          type: "manual",
                          message:
                            "You have reached your plan's QR Code limit.",
                        });
                        setCreating(false);
                        return;
                      default:
                        linkForm.setError("destination", {
                          type: "manual",
                          message: "There was a problem creating your QR Code.",
                        });
                        setCreating(false);
                        return;
                    }
                  }
                  if (qrCodeResponse.success && qrCodeResponse.data) {
                    const updateResponse = await attachQRToShortn(
                      firstLinkResponse.data.shortUrl,
                      qrCodeResponse.data.qrCodeId
                    );
                    if (!updateResponse.success) {
                      linkForm.setError("destination", {
                        type: "manual",
                        message: "There was a problem creating your QR Code.",
                      });
                      setCreating(false);
                      return;
                    }
                    if (updateResponse.success) {
                      router.push(
                        `/dashboard/links/${firstLinkResponse.data.shortUrl}/details`
                      );
                    }
                  }
                }
              } else {
                const firstLinkResponse = await createShortn({
                  longUrl: data.destination,
                  title: data.title,
                  customCode: data.customCode,
                });
                if (!firstLinkResponse.success) {
                  switch (firstLinkResponse.message) {
                    case "duplicate":
                      linkForm.setError("customCode", {
                        type: "manual",
                        message:
                          "You already have a shortn link with that custom back-half.",
                      });
                      setCreating(false);
                      return;
                    case "no-user":
                      linkForm.setError("destination", {
                        type: "manual",
                        message: "User session error.",
                      });
                      setCreating(false);
                      return;
                    case "custom-restricted":
                      linkForm.setError("customCode", {
                        type: "manual",
                        message:
                          "Custom back-halves are restricted to pro accounts.",
                      });
                      setCreating(false);
                      return;
                    case "plan-limit":
                      linkForm.setError("destination", {
                        type: "manual",
                        message: "You have reached your plan's link limit.",
                      });
                      setCreating(false);
                      return;
                    default:
                      linkForm.setError("destination", {
                        type: "manual",
                        message: "There was a problem creating your QR Code.",
                      });
                      setCreating(false);
                      return;
                  }
                }
                if (firstLinkResponse.success && firstLinkResponse.data) {
                  router.push(
                    `/dashboard/links/${firstLinkResponse.data.shortUrl}/details`
                  );
                }
              }
              setCreating(false);
            })}
            disabled={creating}
            variant={"default"}
          >
            {creating ? (
              <>
                <Loader2 className="animate-spin" /> Creating...
              </>
            ) : (
              <>Create your code</>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};
