"use client";

import { StyledQRCode } from "@/components/ui/styled-qr-code";
import { useRef, useState, useEffect, useCallback } from "react";
import { Options } from "qr-code-styling";
import { Skeleton } from "@/components/ui/skeleton";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { getCurrentUsage, UsageData } from "@/app/actions/usageActions";
import { BASEURL, cn, getShortUrl } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  CheckCircle2,
  ChevronRight,
  Circle,
  InfinityIcon,
  Loader2,
  LockIcon,
  Trash2Icon,
} from "lucide-react";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { Link, useRouter } from "@/i18n/navigation";
import InputColor from "@/components/ui/color-input";
import { attachQRToShortn, createShortn } from "@/app/actions/linkActions";
import { createQrCode } from "@/app/actions/qrCodeActions";
import { getLinksLeft } from "../../home/quick-create";

import BASE1 from "@/public/QR-CODES-PREVIEW/BASE-1.png";
import BASE2 from "@/public/QR-CODES-PREVIEW/BASE-2.png";
import BASE3 from "@/public/QR-CODES-PREVIEW/BASE-3.png";
import BASE4 from "@/public/QR-CODES-PREVIEW/BASE-4.png";
import BASE5 from "@/public/QR-CODES-PREVIEW/BASE-5.png";
import BASE6 from "@/public/QR-CODES-PREVIEW/BASE-6.png";

import BORDER1 from "@/public/QR-CODES-PREVIEW/BORDER-1.png";
import BORDER2 from "@/public/QR-CODES-PREVIEW/BORDER-2.png";
import BORDER3 from "@/public/QR-CODES-PREVIEW/BORDER-3.png";
import BORDER4 from "@/public/QR-CODES-PREVIEW/BORDER-4.png";
import BORDER5 from "@/public/QR-CODES-PREVIEW/BORDER-5.png";
import BORDER6 from "@/public/QR-CODES-PREVIEW/BORDER-6.png";

import DOT1 from "@/public/QR-CODES-PREVIEW/DOT-1.png";
import DOT2 from "@/public/QR-CODES-PREVIEW/DOT-2.png";
import DOT3 from "@/public/QR-CODES-PREVIEW/DOT-3.png";
import DOT4 from "@/public/QR-CODES-PREVIEW/DOT-4.png";
import DOT5 from "@/public/QR-CODES-PREVIEW/DOT-5.png";
import DOT6 from "@/public/QR-CODES-PREVIEW/DOT-6.png";
import Image from "next/image";
import { toast } from "sonner";
import { uploadImage } from "@/app/actions/uploadImage";
import { deletePicture } from "@/app/actions/deletePicture";
import { authClient } from "@/lib/authClient";
import { usePlan } from "@/hooks/use-plan";
import { useTranslations } from "next-intl";

export const QRCodeCreate = ({
  state,
  setState,
}: {
  state: "configure" | "customize";
  setState: (arg0: "configure" | "customize") => void;
}) => {
  const t = useTranslations("create-qr");

  const qrCodeFormSchema = z.object({
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
  });

  const { data } = authClient.useSession();
  const user = data?.user;
  const { plan } = usePlan();

  const [usage, setUsage] = useState<UsageData | null>(null);

  const fetchUsage = useCallback(async () => {
    const result = await getCurrentUsage();
    if (result.success && result.data) setUsage(result.data);
  }, []);

  useEffect(() => {
    void fetchUsage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const linksLeft =
    plan != "pro"
      ? (usage?.links.limit ?? 0) - (usage?.links.consumed ?? 0)
      : undefined;

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

  const router = useRouter();

  const qrCodeForm = useForm<z.infer<typeof qrCodeFormSchema>>({
    resolver: zodResolver(qrCodeFormSchema),
    defaultValues: {
      destination: "",
      title: "",
      customCode: "",
    },
  });

  const [createLink, setCreateLink] = useState(false);
  const [presetChosen, setPresetChosen] = useState<number | undefined>(0);

  const [creating, setCreating] = useState(false);
  const [uploading, setUploading] = useState(false);

  const logoRef = useRef<HTMLInputElement | null>(null);

  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const validTypes = ["image/jpeg", "image/png", "image/svg"];
      const maxSizeInBytes = 5 * 1024 * 1024;

      if (!validTypes.includes(file.type)) {
        toast.error(t("toast.invalid-file-type"));
        if (logoRef && logoRef.current) {
          logoRef.current.value = "";
        }
        return;
      }

      if (file.size > maxSizeInBytes) {
        toast.error(t("toast.file-too-large"));
        if (logoRef && logoRef.current) {
          logoRef.current.value = "";
        }
        return;
      }
      setUploading(true);
      const { success, url } = await uploadImage(file);
      if (success && url) {
        if (options.image) {
          await deletePicture(options.image);
        }
        setOptions((prev) => ({
          ...prev,
          image: url as string,
          imageOptions: {
            crossOrigin: "anonymous",
            margin: 2,
            imageSize: 0.6,
          },
        }));
      }
      setUploading(false);
    }
  };

  return (
    <div className="w-full flex flex-row items-start justify-between gap-4 col-span-full">
      <div className="w-full flex flex-col gap-6 items-start">
        <div className="flex flex-row items-center justify-start gap-2">
          <div
            onClick={() => {
              if (state == "customize") {
                setState("configure");
              }
            }}
            className={cn(
              "md:text-base text-sm text-muted-foreground flex flex-row gap-1 items-center justify-start",
              state == "configure" && "text-primary font-bold",
              state == "customize" && "hover:cursor-pointer",
            )}
          >
            {state == "configure" ? (
              <Circle className="h-4 w-auto aspect-square" />
            ) : (
              <CheckCircle2 className="h-4 w-auto aspect-square" />
            )}
            <p>{t("steps.configure")}</p>
          </div>
          <div
            className={cn(
              "bg-muted-foreground/50 w-6 h-0.25",
              state == "customize" && "text-primary",
            )}
          ></div>
          <div
            className={cn(
              "md:text-base text-sm text-muted-foreground flex flex-row gap-1 items-center justify-start",
              state == "customize" && "text-primary font-bold",
              state == "configure" && "hover:cursor-not-allowed",
            )}
          >
            <Circle className="h-4 w-auto aspect-square" />
            <p>{t("steps.customize")}</p>
          </div>
        </div>
        {state == "configure" && (
          <>
            <div className="flex flex-col gap-1 w-full items-start">
              <h1 className="font-bold lg:text-3xl md:text-2xl sm:text-xl text-lg">
                {t("title")}
              </h1>
              {getLinksLeft(
                plan,
                usage?.qrCodes.consumed ?? 0,
                true,
                "text-xs",
              )}
            </div>
            <div className="rounded bg-background lg:p-6 md:p-4 p-3 w-full flex flex-col gap-4">
              <Form {...qrCodeForm}>
                <form className="w-full flex flex-col gap-4">
                  <FormField
                    control={qrCodeForm.control}
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
                    control={qrCodeForm.control}
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
                    {t("ways-to-share")}
                  </h2>
                  <div className="flex flex-row w-full justify-between items-start">
                    <div className="flex flex-col gap-1 items-start w-full max-w-3xs">
                      <p className="font-semibold sm:text-sm text-xs">
                        {t("short-link")}
                      </p>
                      <p className="text-muted-foreground sm:text-sm text-xs">
                        {t("short-link-description")}
                      </p>
                    </div>
                    <div className="flex flex-row gap-2 items-center">
                      {plan == "pro" ? (
                        <div className="text-muted-foreground sm:text-sm text-xs w-full flex flex-row items-center gap-1 border-b border-dashed">
                          <InfinityIcon className="min-w-3! w-3! h-3!" />
                          <p>{t("left")}</p>
                        </div>
                      ) : linksLeft == undefined ? (
                        <div className="text-muted-foreground sm:text-sm text-xs w-full flex flex-row items-center gap-1 border-b border-dashed">
                          <Skeleton className="w-3 h-3" />
                          <p>{t("left")}</p>
                        </div>
                      ) : linksLeft > 0 ? (
                        <p className="text-muted-foreground sm:text-sm text-xs gap-1 flex flex-row items-center border-b border-dashed">
                          <span className="font-semibold">{linksLeft}</span>{" "}
                          {t("left")}
                        </p>
                      ) : (
                        <></>
                      )}
                      <Switch
                        checked={createLink}
                        onCheckedChange={setCreateLink}
                        id="create-link"
                      />
                    </div>
                  </div>
                  {createLink && (
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
                                      className="underline hover:cursor-pointer"
                                      href={`/dashboard/subscription`}
                                    >
                                      {t("upgrade")}
                                    </Link>{" "}
                                    {t("access-stats")}
                                  </p>
                                </div>
                              </HoverCardContent>
                            </HoverCard>
                          )}
                        </div>
                        <FormField
                          control={qrCodeForm.control}
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
                  )}
                </form>
              </Form>

              <div className="flex flex-row items-center justify-between mt-4">
                <Button
                  onClick={() => {
                    router.push(`/dashboard`);
                  }}
                  variant={"secondary"}
                >
                  {t("cancel")}
                </Button>
                <Button
                  onClick={qrCodeForm.handleSubmit(() => {
                    setOptions((prev) => ({
                      ...prev,
                      data: `${BASEURL}/qr-code-preview`,
                    }));
                    setState("customize");
                  })}
                  variant={"default"}
                >
                  {t("customize-code")} <ChevronRight />
                </Button>
              </div>
            </div>
          </>
        )}
        {state == "customize" && (
          <div className="rounded bg-background lg:p-6 md:p-4 p-3 w-full flex flex-col gap-4">
            <div className="flex flex-col gap-2 items-start">
              <h1 className="lg:text-2xl md:text-xl sm:text-lg text-base font-bold">
                {t("select-styles")}
              </h1>
              <p className="lg:text-base text-sm font-semibold">
                {t("patterns")}
              </p>
              <div className="w-full grid grid-cols-6 gap-2">
                <Button
                  variant={"outline"}
                  onClick={() => {
                    setOptions((prev) => ({
                      ...prev,
                      dotsOptions: { ...prev.dotsOptions, type: "square" },
                    }));
                  }}
                  className={cn(
                    "col-span-1 w-full aspect-square h-auto xs:p-2! p-1! rounded!",
                    options.dotsOptions?.type == "square" &&
                      "border-2 border-primary",
                  )}
                >
                  <Image
                    src={BASE1}
                    alt="border-preview"
                    className="w-full h-auto aspect-square! object-contain"
                  />
                </Button>
                <Button
                  variant={"outline"}
                  onClick={() => {
                    setOptions((prev) => ({
                      ...prev,
                      dotsOptions: { ...prev.dotsOptions, type: "rounded" },
                    }));
                  }}
                  className={cn(
                    "col-span-1 w-full aspect-square h-auto xs:p-2! p-1! rounded!",
                    options.dotsOptions?.type == "rounded" &&
                      "border-2 border-primary",
                  )}
                >
                  <Image
                    src={BASE2}
                    alt="border-preview"
                    className="w-full h-auto aspect-square! object-contain"
                  />
                </Button>
                <Button
                  variant={"outline"}
                  onClick={() => {
                    setOptions((prev) => ({
                      ...prev,
                      dotsOptions: { ...prev.dotsOptions, type: "dots" },
                    }));
                  }}
                  className={cn(
                    "col-span-1 w-full aspect-square h-auto xs:p-2! p-1! rounded!",
                    options.dotsOptions?.type == "dots" &&
                      "border-2 border-primary",
                  )}
                >
                  <Image
                    src={BASE3}
                    alt="border-preview"
                    className="w-full h-auto aspect-square! object-contain"
                  />
                </Button>
                <Button
                  variant={"outline"}
                  onClick={() => {
                    setOptions((prev) => ({
                      ...prev,
                      dotsOptions: { ...prev.dotsOptions, type: "classy" },
                    }));
                  }}
                  className={cn(
                    "col-span-1 w-full aspect-square h-auto xs:p-2! p-1! rounded!",
                    options.dotsOptions?.type == "classy" &&
                      "border-2 border-primary",
                  )}
                >
                  <Image
                    src={BASE4}
                    alt="border-preview"
                    className="w-full h-auto aspect-square! object-contain"
                  />
                </Button>
                <Button
                  variant={"outline"}
                  onClick={() => {
                    setOptions((prev) => ({
                      ...prev,
                      dotsOptions: {
                        ...prev.dotsOptions,
                        type: "classy-rounded",
                      },
                    }));
                  }}
                  className={cn(
                    "col-span-1 w-full aspect-square h-auto xs:p-2! p-1! rounded!",
                    options.dotsOptions?.type == "classy-rounded" &&
                      "border-2 border-primary",
                  )}
                >
                  <Image
                    src={BASE5}
                    alt="border-preview"
                    className="w-full h-auto aspect-square! object-contain"
                  />
                </Button>
                <Button
                  variant={"outline"}
                  onClick={() => {
                    setOptions((prev) => ({
                      ...prev,
                      dotsOptions: {
                        ...prev.dotsOptions,
                        type: "extra-rounded",
                      },
                    }));
                  }}
                  className={cn(
                    "col-span-1 w-full aspect-square! h-auto xs:p-2! p-1! rounded!",
                    options.dotsOptions?.type == "extra-rounded" &&
                      "border-2 border-primary",
                  )}
                >
                  <Image
                    src={BASE6}
                    alt="border-preview"
                    className="w-full h-auto aspect-square! object-contain"
                  />
                </Button>
              </div>
            </div>
            <div className="w-full flex flex-col gap-2 items-start">
              <p className="lg:text-base text-sm font-semibold">
                {t("corners")}
              </p>
              <p className="lg:text-sm text-xs font-medium">{t("borders")}</p>
              <div className="w-full grid grid-cols-6 gap-2 max-w-xs">
                <Button
                  variant={"outline"}
                  onClick={() => {
                    setOptions((prev) => ({
                      ...prev,
                      cornersSquareOptions: {
                        ...prev.cornersSquareOptions,
                        type: "square",
                      },
                    }));
                  }}
                  className={cn(
                    "col-span-1 w-full aspect-square h-auto xs:p-2! p-1! rounded!",
                    options.cornersSquareOptions?.type == "square" &&
                      "border-2 border-primary",
                  )}
                >
                  <Image
                    src={BORDER1}
                    alt="border-preview"
                    className="w-full h-auto aspect-square! object-contain"
                  />
                </Button>
                <Button
                  variant={"outline"}
                  onClick={() => {
                    setOptions((prev) => ({
                      ...prev,
                      cornersSquareOptions: {
                        ...prev.cornersSquareOptions,
                        type: "rounded",
                      },
                    }));
                  }}
                  className={cn(
                    "col-span-1 w-full aspect-square h-auto xs:p-2! p-1! rounded!",
                    options.cornersSquareOptions?.type == "rounded" &&
                      "border-2 border-primary",
                  )}
                >
                  <Image
                    src={BORDER2}
                    alt="border-preview"
                    className="w-full h-auto aspect-square! object-contain"
                  />
                </Button>
                <Button
                  variant={"outline"}
                  onClick={() => {
                    setOptions((prev) => ({
                      ...prev,
                      cornersSquareOptions: {
                        ...prev.cornersSquareOptions,
                        type: "dots",
                      },
                    }));
                  }}
                  className={cn(
                    "col-span-1 w-full aspect-square h-auto xs:p-2! p-1! rounded!",
                    options.cornersSquareOptions?.type == "dots" &&
                      "border-2 border-primary",
                  )}
                >
                  <Image
                    src={BORDER3}
                    alt="border-preview"
                    className="w-full h-auto aspect-square! object-contain"
                  />
                </Button>
                <Button
                  variant={"outline"}
                  onClick={() => {
                    setOptions((prev) => ({
                      ...prev,
                      cornersSquareOptions: {
                        ...prev.cornersSquareOptions,
                        type: "classy",
                      },
                    }));
                  }}
                  className={cn(
                    "col-span-1 w-full aspect-square h-auto xs:p-2! p-1! rounded!",
                    options.cornersSquareOptions?.type == "classy" &&
                      "border-2 border-primary",
                  )}
                >
                  <Image
                    src={BORDER4}
                    alt="border-preview"
                    className="w-full h-auto aspect-square! object-contain"
                  />
                </Button>
                <Button
                  variant={"outline"}
                  onClick={() => {
                    setOptions((prev) => ({
                      ...prev,
                      cornersSquareOptions: {
                        ...prev.cornersSquareOptions,
                        type: "classy-rounded",
                      },
                    }));
                  }}
                  className={cn(
                    "col-span-1 w-full aspect-square h-auto xs:p-2! p-1! rounded!",
                    options.cornersSquareOptions?.type == "classy-rounded" &&
                      "border-2 border-primary",
                  )}
                >
                  <Image
                    src={BORDER5}
                    alt="border-preview"
                    className="w-full h-auto aspect-square! object-contain"
                  />
                </Button>
                <Button
                  variant={"outline"}
                  onClick={() => {
                    setOptions((prev) => ({
                      ...prev,
                      cornersSquareOptions: {
                        ...prev.cornersSquareOptions,
                        type: "extra-rounded",
                      },
                    }));
                  }}
                  className={cn(
                    "col-span-1 w-full aspect-square h-auto xs:p-2! p-1! rounded!",
                    options.cornersSquareOptions?.type == "extra-rounded" &&
                      "border-2 border-primary",
                  )}
                >
                  <Image
                    src={BORDER6}
                    alt="border-preview"
                    className="w-full h-auto aspect-square! object-contain"
                  />
                </Button>
              </div>
              <p className="lg:text-sm text-xs font-medium">{t("dots")}</p>
              <div className="w-full grid grid-cols-6 gap-2 max-w-xs">
                <Button
                  variant={"outline"}
                  onClick={() => {
                    setOptions((prev) => ({
                      ...prev,
                      cornersDotOptions: {
                        ...prev.cornersDotOptions,
                        type: "square",
                      },
                    }));
                  }}
                  className={cn(
                    "col-span-1 w-full aspect-square h-auto xs:p-2! p-1! rounded!",
                    options.cornersDotOptions?.type == "square" &&
                      "border-2 border-primary",
                  )}
                >
                  <Image
                    src={DOT1}
                    alt="border-preview"
                    className="w-full h-auto aspect-square! object-contain"
                  />
                </Button>
                <Button
                  variant={"outline"}
                  onClick={() => {
                    setOptions((prev) => ({
                      ...prev,
                      cornersDotOptions: {
                        ...prev.cornersDotOptions,
                        type: "rounded",
                      },
                    }));
                  }}
                  className={cn(
                    "col-span-1 w-full aspect-square h-auto xs:p-2! p-1! rounded!",
                    options.cornersDotOptions?.type == "rounded" &&
                      "border-2 border-primary",
                  )}
                >
                  <Image
                    src={DOT2}
                    alt="border-preview"
                    className="w-full h-auto aspect-square! object-contain"
                  />
                </Button>
                <Button
                  variant={"outline"}
                  onClick={() => {
                    setOptions((prev) => ({
                      ...prev,
                      cornersDotOptions: {
                        ...prev.cornersDotOptions,
                        type: "dots",
                      },
                    }));
                  }}
                  className={cn(
                    "col-span-1 w-full aspect-square h-auto xs:p-2! p-1! rounded!",
                    options.cornersDotOptions?.type == "dots" &&
                      "border-2 border-primary",
                  )}
                >
                  <Image
                    src={DOT3}
                    alt="border-preview"
                    className="w-full h-auto aspect-square! object-contain"
                  />
                </Button>
                <Button
                  variant={"outline"}
                  onClick={() => {
                    setOptions((prev) => ({
                      ...prev,
                      cornersDotOptions: {
                        ...prev.cornersDotOptions,
                        type: "classy",
                      },
                    }));
                  }}
                  className={cn(
                    "col-span-1 w-full aspect-square h-auto xs:p-2! p-1! rounded!",
                    options.cornersDotOptions?.type == "classy" &&
                      "border-2 border-primary",
                  )}
                >
                  <Image
                    src={DOT4}
                    alt="border-preview"
                    className="w-full h-auto aspect-square! object-contain"
                  />
                </Button>
                <Button
                  variant={"outline"}
                  onClick={() => {
                    setOptions((prev) => ({
                      ...prev,
                      cornersDotOptions: {
                        ...prev.cornersDotOptions,
                        type: "classy-rounded",
                      },
                    }));
                  }}
                  className={cn(
                    "col-span-1 w-full aspect-square h-auto xs:p-2! p-1! rounded!",
                    options.cornersDotOptions?.type == "classy-rounded" &&
                      "border-2 border-primary",
                  )}
                >
                  <Image
                    src={DOT5}
                    alt="border-preview"
                    className="w-full h-auto aspect-square! object-contain"
                  />
                </Button>
                <Button
                  variant={"outline"}
                  onClick={() => {
                    setOptions((prev) => ({
                      ...prev,
                      cornersDotOptions: {
                        ...prev.cornersDotOptions,
                        type: "extra-rounded",
                      },
                    }));
                  }}
                  className={cn(
                    "col-span-1 w-full aspect-square h-auto xs:p-2! p-1! rounded!",
                    options.cornersDotOptions?.type == "extra-rounded" &&
                      "border-2 border-primary",
                  )}
                >
                  <Image
                    src={DOT6}
                    alt="border-preview"
                    className="w-full h-auto aspect-square! object-contain"
                  />
                </Button>
              </div>
            </div>
            <div className="w-full flex flex-col gap-2 items-start">
              <h1 className="lg:text-2xl md:text-xl sm:text-lg text-base font-bold">
                {t("choose-colors")}
              </h1>
              <p className="lg:text-base text-sm font-semibold">
                {t("presets")}
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
            <div className="w-full flex flex-col gap-2 items-start">
              <InputColor
                className="w-full"
                onBlur={() => {}}
                label={t("code-color")}
                value={options.dotsOptions?.color || "#000"}
                onChange={(v) => {
                  setPresetChosen(undefined);
                  setOptions((prev) => ({
                    ...prev,
                    dotsOptions: { ...prev.dotsOptions, color: v },
                  }));
                }}
              />
              <InputColor
                className="w-full"
                onBlur={() => {}}
                label={t("background-color")}
                value={options.backgroundOptions?.color || "#ffffff"}
                onChange={(v) => {
                  setPresetChosen(undefined);
                  setOptions((prev) => ({
                    ...prev,
                    backgroundOptions: { ...prev.backgroundOptions, color: v },
                  }));
                }}
              />
            </div>
            <div className="w-full flex flex-col gap-2 items-start">
              {plan != "pro" && plan != "plus" ? (
                <HoverCard>
                  <HoverCardTrigger
                    className="px-1 rounded-none! h-fit flex flex-row items-baseline
                  gap-1! hover:cursor-help lg:text-2xl md:text-xl sm:text-lg text-base font-bold"
                  >
                    {t("add-logo")}
                    <LockIcon className="w-4! h-4!" />
                  </HoverCardTrigger>
                  <HoverCardContent align="end" asChild>
                    <div className="w-full max-w-[300px] p-2! px-3! rounded bg-primary text-primary-foreground flex flex-col gap-0 items-start text-xs cursor-help">
                      <p className="text-sm font-bold">{t("unlock-logos")}</p>
                      <p>
                        <Link
                          className="underline hover:cursor-pointer"
                          href={`/dashboard/subscription`}
                        >
                          {t("upgrade")}
                        </Link>{" "}
                        {t("logo-upgrade-description")}
                      </p>
                    </div>
                  </HoverCardContent>
                </HoverCard>
              ) : (
                <h1 className="lg:text-2xl md:text-xl sm:text-lg text-base font-bold">
                  {t("add-logo")}
                </h1>
              )}

              <p className="lg:text-base text-sm font-semibold">
                {t("choose-picture")}
              </p>
              <div className="w-full flex flex-col gap-1 items-start sm:max-w-sm">
                <div className="w-full flex flex-row items-center gap-1 sm:max-w-sm">
                  <Input
                    ref={logoRef}
                    disabled={
                      !user || (plan != "pro" && plan != "plus") || uploading
                    }
                    onChange={handleChange}
                    type="file"
                    className="grow"
                  />
                  {uploading && (
                    <Button variant={"secondary"} disabled>
                      <Loader2 className="animate-spin" />
                      {t("uploading")}
                    </Button>
                  )}
                  {options.image && (
                    <Button
                      onClick={() => {
                        if (options.image) {
                          deletePicture(options.image);
                          setOptions((prev) => ({
                            ...prev,
                            image: undefined,
                          }));
                          if (logoRef && logoRef.current) {
                            logoRef.current.value = "";
                          }
                        }
                      }}
                      variant={"secondary"}
                    >
                      <Trash2Icon />
                      {t("remove-logo")}
                    </Button>
                  )}
                </div>

                <p className="text-muted-foreground font-light text-xs">
                  {t("file-requirements")}
                </p>
              </div>
            </div>
            <div className="flex flex-row items-center justify-between mt-4">
              <Button
                onClick={() => {
                  if (options.image) {
                    deletePicture(options.image);
                  }
                  router.push(`/dashboard`);
                }}
                variant={"secondary"}
              >
                {t("cancel")}
              </Button>
              <Button
                onClick={async () => {
                  setCreating(true);
                  if (createLink) {
                    const firstLinkResponse = await createShortn({
                      longUrl: qrCodeForm.getValues("destination"),
                      title: qrCodeForm.getValues("title") || "",
                      customCode: qrCodeForm.getValues("customCode") || "",
                    });
                    if (!firstLinkResponse.success) {
                      switch (firstLinkResponse.message) {
                        case "no-user":
                          qrCodeForm.setError("destination", {
                            type: "manual",
                            message: t("toast.session-error"),
                          });
                          setState("configure");
                          setCreating(false);
                          return;
                        case "custom-restricted":
                          qrCodeForm.setError("destination", {
                            type: "manual",
                            message: t("toast.custom-restricted"),
                          });
                          setState("configure");
                          setCreating(false);
                          return;
                        case "plan-limit":
                          qrCodeForm.setError("destination", {
                            type: "manual",
                            message: t("toast.link-limit"),
                          });
                          setState("configure");
                          setCreating(false);
                          return;
                        case "duplicate":
                          qrCodeForm.setError("customCode", {
                            type: "manual",
                            message: t("toast.duplicate-backhalf"),
                          });
                          setState("configure");
                          setCreating(false);
                          break;
                        default:
                          qrCodeForm.setError("destination", {
                            type: "manual",
                            message: t("toast.qr-error"),
                          });
                          setState("configure");
                          setCreating(false);
                          return;
                      }
                    }
                    if (firstLinkResponse.success && firstLinkResponse.data) {
                      const shortUrl = getShortUrl(
                        firstLinkResponse.data.shortUrl,
                      );
                      const qrCodeResponse = await createQrCode({
                        longUrl: qrCodeForm.getValues("destination"),
                        title: qrCodeForm.getValues("title") || "",
                        attachedUrl: shortUrl,
                        options,
                      });
                      if (!qrCodeResponse.success) {
                        switch (qrCodeResponse.message) {
                          case "no-user":
                            qrCodeForm.setError("destination", {
                              type: "destination",
                              message: t("toast.session-error"),
                            });
                            setState("configure");
                            setCreating(false);
                            return;
                          case "plan-limit":
                            qrCodeForm.setError("destination", {
                              type: "destination",
                              message: t("toast.qr-limit"),
                            });
                            setState("configure");
                            setCreating(false);
                            return;
                          default:
                            qrCodeForm.setError("destination", {
                              type: "manual",
                              message: t("toast.qr-error"),
                            });
                            setState("configure");
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
                          qrCodeForm.setError("destination", {
                            type: "manual",
                            message: t("toast.qr-error"),
                          });
                          setState("configure");
                          setCreating(false);
                          return;
                        }
                        if (updateResponse.success) {
                          await fetchUsage();
                          router.push(
                            `/dashboard/qr-codes/${qrCodeResponse.data.qrCodeId}/details`,
                          );
                          return;
                        }
                      }
                    }
                  } else {
                    const qrCodeResponse = await createQrCode({
                      longUrl: qrCodeForm.getValues("destination"),
                      title: qrCodeForm.getValues("title") || "",
                      options,
                    });
                    if (!qrCodeResponse.success) {
                      switch (qrCodeResponse.message) {
                        case "no-user":
                          qrCodeForm.setError("destination", {
                            type: "manual",
                            message: t("toast.session-error"),
                          });
                          setState("configure");
                          setCreating(false);
                          return;
                        case "plan-limit":
                          qrCodeForm.setError("destination", {
                            type: "manual",
                            message: t("toast.qr-limit"),
                          });
                          setState("configure");
                          setCreating(false);
                          return;
                        default:
                          qrCodeForm.setError("destination", {
                            type: "manual",
                            message: t("toast.qr-error"),
                          });
                          setState("configure");
                          setCreating(false);
                          return;
                      }
                    }
                    if (qrCodeResponse.success && qrCodeResponse.data) {
                      await fetchUsage();
                      router.push(
                        `/dashboard/qr-codes/${qrCodeResponse.data.qrCodeId}/details`,
                      );
                      return;
                    }
                  }
                  setCreating(false);
                }}
                disabled={creating}
                variant={"default"}
              >
                {creating ? (
                  <>
                    <Loader2 className="animate-spin" /> {t("creating")}
                  </>
                ) : (
                  <>{t("create-code")}</>
                )}
              </Button>
            </div>
          </div>
        )}
      </div>
      <div className="w-full max-w-xs lg:flex hidden flex-col gap-4 items-center text-center">
        <p className="font-semibold text-muted-foreground lg:text-lg text-base">
          {t("preview")}
        </p>
        <div className="w-full h-auto max-w-52 aspect-square bg-background p-4 flex flex-col">
          <StyledQRCode className="w-full" options={options} />
        </div>
        <p className="text-xs text-muted-foreground">
          {t("preview-disclaimer")}
        </p>
      </div>
    </div>
  );
};
