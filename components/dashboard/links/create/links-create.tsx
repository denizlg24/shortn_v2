"use client";

import { attachQRToShortn, createShortn } from "@/app/actions/linkActions";
import { createQrCode } from "@/app/actions/qrCodeActions";
import { getCurrentUsage, UsageData } from "@/app/actions/usageActions";
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
import { BASEURL, cn } from "@/lib/utils";
import { zodResolver } from "@hookform/resolvers/zod";
import { InfinityIcon, Loader2, LockIcon, Eye, EyeOff } from "lucide-react";
import { Options } from "qr-code-styling";
import { useCallback, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { getLinksLeft } from "../../home/quick-create";
import { usePlan } from "@/hooks/use-plan";
import { useTranslations } from "next-intl";

export const LinksCreate = () => {
  const t = useTranslations("create-link");

  const linkFormSchema = z.object({
    destination: z
      .string()
      .min(1, t("validation.url-required"))
      .url(t("validation.invalid-url")),
    title: z.string().optional(),
    customCode: z
      .union([
        z
          .string()
          .min(3, t("validation.back-half-too-short"))
          .max(52, t("validation.back-half-too-long"))
          .regex(/^[a-zA-Z0-9_-]+$/, t("validation.back-half-invalid-chars")),
        z.literal(""),
      ])
      .optional(),
    password: z
      .union([
        z
          .string()
          .min(6, t("validation.password-too-short"))
          .max(100, t("validation.password-too-long")),
        z.literal(""),
      ])
      .optional(),
    passwordHint: z.string().max(100, t("validation.hint-too-long")).optional(),
  });

  const { plan } = usePlan();
  const router = useRouter();
  const [presetChosen, setPresetChosen] = useState<number | undefined>(0);

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
    plan && plan != "pro"
      ? allowedLinks[plan as "free" | "basic" | "plus"] -
        (usage?.qrCodes.consumed ?? 0)
      : undefined;

  const linkForm = useForm<z.infer<typeof linkFormSchema>>({
    resolver: zodResolver(linkFormSchema),
    defaultValues: {
      destination: "",
      title: "",
      customCode: "",
      password: "",
      passwordHint: "",
    },
  });

  const [addQR, setAddQR] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="w-full flex flex-col gap-6 items-start col-span-full">
      <div className="flex flex-col gap-1 w-full items-start">
        <h1 className="font-bold lg:text-3xl md:text-2xl sm:text-xl text-lg">
          {t("title")}
        </h1>
        {usageLoading ? (
          <Skeleton className="h-4 w-48" />
        ) : (
          getLinksLeft(
            plan ?? "free",
            usage?.links.consumed ?? 0,
            false,
            "text-xs",
          )
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
                  <FormLabel>{t("destination")}</FormLabel>
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
                  <FormLabel>{t("title-optional")}</FormLabel>
                  <FormControl>
                    <Input className="w-full" placeholder="" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <h2 className="font-semibold lg:text-xl sm:text-lg text-base">
              {t("short-link")}
            </h2>
            <div className="w-full flex flex-row items-end justify-center gap-2 -mt-2">
              <div className="w-full grow flex flex-col items-start gap-2">
                <p className="sm:text-sm text-xs font-semibold">
                  {t("domain")}
                </p>
                <Input disabled className="w-full" value={BASEURL} />
              </div>
              <div className="h-9 text-sm flex items-center justify-center">
                <p>/</p>
              </div>
              <div className="w-full grow flex flex-col items-start gap-2">
                <div className="flex flex-row items-center gap-1">
                  <p className="sm:text-sm text-xs font-semibold">
                    {t("custom-backhalf")}
                  </p>
                  {plan != "pro" && (
                    <HoverCard>
                      <HoverCardTrigger>
                        <LockIcon className="w-3! h-3!" />
                      </HoverCardTrigger>
                      <HoverCardContent asChild>
                        <div className="w-full max-w-[300px] p-2! px-3! rounded bg-primary text-primary-foreground flex flex-col gap-0 items-start text-xs cursor-help">
                          <p className="text-sm font-bold">
                            {t("unlock-custom")}
                          </p>
                          <p>
                            <Link
                              href={`/dashboard/subscription`}
                              className="underline hover:cursor-pointer"
                            >
                              {t("upgrade")}
                            </Link>
                            {t("access-stats")}
                          </p>
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
                          disabled={plan != "pro"}
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

            <div className="w-full border-t pt-6 flex flex-col gap-4">
              <div className="flex flex-row items-center justify-between">
                <div className="flex flex-col gap-1">
                  <div className="flex flex-row items-center gap-2">
                    <LockIcon className="w-4 h-4" />
                    <h2 className="font-semibold lg:text-xl sm:text-lg text-base">
                      {t("password-protection")}
                    </h2>
                    {plan !== "pro" && (
                      <span className="text-xs bg-secondary text-secondary-foreground px-2 py-0.5 rounded-full font-medium">
                        {t("pro")}
                      </span>
                    )}
                  </div>
                  <p className="text-muted-foreground sm:text-sm text-xs">
                    {plan === "pro"
                      ? t("require-password")
                      : t("upgrade-password")}
                  </p>
                </div>
                {plan !== "pro" && (
                  <Link href="/dashboard/subscription">
                    <Button variant="outline" size="sm">
                      {t("upgrade")}
                    </Button>
                  </Link>
                )}
              </div>

              {plan === "pro" && (
                <div className="flex flex-col gap-4">
                  <FormField
                    control={linkForm.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem className="w-full relative">
                        <FormLabel className="text-sm font-medium">
                          {t("password-optional")}
                        </FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Input
                              type={showPassword ? "text" : "password"}
                              placeholder={t("password-placeholder")}
                              className="pr-10"
                              minLength={6}
                              {...field}
                            />
                            <button
                              type="button"
                              onClick={() => setShowPassword(!showPassword)}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                              tabIndex={-1}
                            >
                              {showPassword ? (
                                <EyeOff className="h-4 w-4" />
                              ) : (
                                <Eye className="h-4 w-4" />
                              )}
                            </button>
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={linkForm.control}
                    name="passwordHint"
                    render={({ field }) => (
                      <FormItem className="w-full relative">
                        <FormLabel className="text-sm font-medium">
                          {t("password-hint")}
                        </FormLabel>
                        <FormControl>
                          <Input
                            placeholder={t("password-hint-example")}
                            {...field}
                          />
                        </FormControl>
                        <p className="text-xs text-muted-foreground mt-1">
                          {t("password-hint-description")}
                        </p>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              )}
            </div>
          </form>
        </Form>

        <h2 className="font-semibold lg:text-xl sm:text-lg text-base">
          {t("ways-to-share")}
        </h2>
        <div className="flex flex-row w-full justify-between items-start">
          <div className="flex flex-col gap-1 items-start w-full max-w-3xs">
            <p className="font-semibold sm:text-sm text-xs">{t("qr-code")}</p>
            <p className="text-muted-foreground sm:text-sm text-xs">
              {t("qr-description")}
            </p>
          </div>
          <div className="flex flex-row gap-2 items-center">
            {plan == "pro" ? (
              <div className="text-muted-foreground sm:text-sm text-xs w-full flex flex-row items-center gap-1 border-b border-dashed">
                <InfinityIcon className="min-w-3! w-3! h-3!" />
                <p>{t("left")}</p>
              </div>
            ) : qrCodesLeft == undefined ? (
              <div className="text-muted-foreground sm:text-sm text-xs w-full flex flex-row items-center gap-1 border-b border-dashed">
                <Skeleton className="w-3 h-3" />
                <p>{t("left")}</p>
              </div>
            ) : qrCodesLeft > 0 ? (
              <p className="text-muted-foreground sm:text-sm text-xs gap-1 flex flex-row items-center border-b border-dashed">
                <span className="font-semibold">{qrCodesLeft}</span> {t("left")}
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
                  {t("choose-color")}
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
                      presetChosen == 0 && "border-2 border-primary",
                    )}
                  >
                    <div className="w-full h-full rounded-full bg-black"></div>
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
                      presetChosen == 1 && "border-2 border-primary",
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
                      presetChosen == 2 && "border-2 border-primary",
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
                      presetChosen == 3 && "border-2 border-primary",
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
                      presetChosen == 4 && "border-2 border-primary",
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
                      presetChosen == 5 && "border-2 border-primary",
                    )}
                  >
                    <div className="w-full h-full rounded-full bg-[#6B52D1]"></div>
                  </Button>
                </div>
              </div>
            </div>
            <div className="w-full bg-background max-w-xs lg:flex hidden flex-col gap-4 p-4 items-center text-center">
              <p className="font-semibold text-muted-foreground lg:text-lg text-base">
                {t("preview")}
              </p>
              <div className="w-full border h-auto max-w-32 aspect-square bg-background p-1 flex flex-col">
                <StyledQRCode className="w-full" options={options} />
              </div>
              <p className="text-xs text-muted-foreground">
                {t("more-customizations")}
              </p>
            </div>
          </div>
        )}
        <div className="flex flex-row items-center justify-between mt-4">
          <Button
            onClick={() => {
              router.push("/dashboard");
            }}
            variant={"secondary"}
          >
            {t("cancel")}
          </Button>
          <Button
            onClick={linkForm.handleSubmit(async (data) => {
              setCreating(true);
              if (addQR) {
                const firstLinkResponse = await createShortn({
                  longUrl: data.destination,
                  title: data.title,
                  customCode: data.customCode,
                  password: data.password,
                  passwordHint: data.passwordHint,
                });
                if (!firstLinkResponse.success) {
                  switch (firstLinkResponse.message) {
                    case "duplicate":
                      linkForm.setError("customCode", {
                        type: "manual",
                        message: t("toast.duplicate-backhalf"),
                      });
                      setCreating(false);
                      return;
                    case "no-user":
                      linkForm.setError("destination", {
                        type: "manual",
                        message: t("toast.session-error"),
                      });
                      setCreating(false);
                      return;
                    case "custom-restricted":
                      linkForm.setError("customCode", {
                        type: "manual",
                        message: t("toast.custom-restricted"),
                      });
                      setCreating(false);
                      return;
                    case "plan-limit":
                      linkForm.setError("destination", {
                        type: "manual",
                        message: t("toast.link-limit"),
                      });
                      setCreating(false);
                      return;
                    case "password-pro-only":
                      linkForm.setError("password", {
                        type: "manual",
                        message: t("toast.password-pro"),
                      });
                      setCreating(false);
                      return;
                    default:
                      linkForm.setError("destination", {
                        type: "manual",
                        message: t("toast.qr-error"),
                      });
                      setCreating(false);
                      return;
                  }
                }
                if (firstLinkResponse.success && firstLinkResponse.data) {
                  const shortUrl = firstLinkResponse.data.shortUrl;
                  const qrCodeResponse = await createQrCode({
                    longUrl: data.destination,
                    title: data.title,
                    attachedUrl: shortUrl,
                    options,
                  });
                  if (!qrCodeResponse.success) {
                    switch (qrCodeResponse.message) {
                      case "no-user":
                        linkForm.setError("destination", {
                          type: "manual",
                          message: t("toast.session-error"),
                        });
                        setCreating(false);
                        return;
                      case "plan-limit":
                        linkForm.setError("destination", {
                          type: "manual",
                          message: t("toast.qr-limit"),
                        });
                        setCreating(false);
                        return;
                      default:
                        linkForm.setError("destination", {
                          type: "manual",
                          message: t("toast.qr-error"),
                        });
                        setCreating(false);
                        return;
                    }
                  }
                  if (qrCodeResponse.success && qrCodeResponse.data) {
                    const updateResponse = await attachQRToShortn(
                      shortUrl,
                      qrCodeResponse.data.qrCodeId,
                    );
                    if (!updateResponse.success) {
                      linkForm.setError("destination", {
                        type: "manual",
                        message: t("toast.qr-error"),
                      });
                      setCreating(false);
                      return;
                    }
                    if (updateResponse.success) {
                      await fetchUsage();
                      router.push(`/dashboard/links/${shortUrl}/details`);
                    }
                  }
                }
              } else {
                const firstLinkResponse = await createShortn({
                  longUrl: data.destination,
                  title: data.title,
                  customCode: data.customCode,
                  password: data.password,
                  passwordHint: data.passwordHint,
                });
                if (!firstLinkResponse.success) {
                  switch (firstLinkResponse.message) {
                    case "duplicate":
                      linkForm.setError("customCode", {
                        type: "manual",
                        message: t("toast.duplicate-backhalf"),
                      });
                      setCreating(false);
                      return;
                    case "no-user":
                      linkForm.setError("destination", {
                        type: "manual",
                        message: t("toast.session-error"),
                      });
                      setCreating(false);
                      return;
                    case "custom-restricted":
                      linkForm.setError("customCode", {
                        type: "manual",
                        message: t("toast.custom-restricted"),
                      });
                      setCreating(false);
                      return;
                    case "plan-limit":
                      linkForm.setError("destination", {
                        type: "manual",
                        message: t("toast.link-limit"),
                      });
                      setCreating(false);
                      return;
                    case "password-pro-only":
                      linkForm.setError("password", {
                        type: "manual",
                        message: t("toast.password-pro"),
                      });
                      setCreating(false);
                      return;
                    default:
                      linkForm.setError("destination", {
                        type: "manual",
                        message: t("toast.qr-error"),
                      });
                      setCreating(false);
                      return;
                  }
                }
                if (firstLinkResponse.success && firstLinkResponse.data) {
                  const shortUrl = firstLinkResponse.data.shortUrl;
                  await fetchUsage();
                  router.push(`/dashboard/links/${shortUrl}/details`);
                  return;
                }
              }
              setCreating(false);
            })}
            disabled={creating}
            variant={"default"}
          >
            {creating ? (
              <>
                <Loader2 className="animate-spin" /> {t("creating")}
              </>
            ) : (
              <>{t("shorten-link")}</>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};
