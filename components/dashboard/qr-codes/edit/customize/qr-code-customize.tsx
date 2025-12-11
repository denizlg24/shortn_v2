"use client";

import { updateQRCodeOptions } from "@/app/actions/qrCodeActions";
import { Button } from "@/components/ui/button";
import InputColor from "@/components/ui/color-input";
import { StyledQRCode } from "@/components/ui/styled-qr-code";
import { Link, useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { IQRCode } from "@/models/url/QRCodeV2";
import { Loader2, LockIcon, Trash2Icon } from "lucide-react";
import { Options } from "qr-code-styling";
import { useRef, useState, useEffect } from "react";
import Image from "next/image";
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
import { deletePicture } from "@/app/actions/deletePicture";
import { uploadImage } from "@/app/actions/uploadImage";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { authClient } from "@/lib/authClient";
import { SubscriptionsType } from "@/utils/plan-utils";
import { fetchApi } from "@/lib/utils";

export const QRCodeCustomize = ({ qrCode }: { qrCode: IQRCode }) => {
  const [options, setOptions] = useState<Partial<Options>>(qrCode.options);

  const router = useRouter();
  const { isPending, isRefetching } = authClient.useSession();
  const [plan, setPlan] = useState<SubscriptionsType>("free");

  useEffect(() => {
    if (isPending || isRefetching) {
      return;
    }
    const fetchPlan = async () => {
      const res = await fetchApi<{ plan: SubscriptionsType; lastPaid?: Date }>(
        "auth/user/subscription",
      );

      if (res.success) {
        console.log("Fetched plan:", res.plan);
        setPlan(res.plan);
      } else {
        setPlan("free");
      }
    };
    fetchPlan();
  }, [isPending, isRefetching]);

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
        toast.error("Invalid file type. Only JPG, PNG, and SVG are allowed.");
        if (logoRef && logoRef.current) {
          logoRef.current.value = "";
        }
        return;
      }

      if (file.size > maxSizeInBytes) {
        toast.error("File is too large. Must be under 2MB.");
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
        <h1 className="font-bold lg:text-3xl md:text-2xl sm:text-xl text-lg">
          Customize your QR Code
        </h1>
        <div className="rounded bg-background lg:p-6 md:p-4 p-3 w-full flex flex-col gap-4">
          <div className="flex flex-col gap-2 items-start">
            <h1 className="lg:text-2xl md:text-xl sm:text-lg text-base font-bold">
              Select styles
            </h1>
            <p className="lg:text-base text-sm font-semibold">Patterns</p>
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
                  "col-span-1 w-full aspect-square h-full xs:p-2! p-1! rounded!",
                  options.dotsOptions?.type == "extra-rounded" &&
                    "border-2 border-primary",
                )}
              >
                <div className="w-full h-auto aspect-square">
                  <Image
                    src={BASE6}
                    alt="border-preview"
                    className="w-full h-auto aspect-square! object-contain"
                  />
                </div>
              </Button>
            </div>
          </div>
          <div className="w-full flex flex-col gap-2 items-start">
            <p className="lg:text-base text-sm font-semibold">Corners</p>
            <p className="lg:text-sm text-xs font-medium">Borders</p>
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
            <p className="lg:text-sm text-xs font-medium">Dots</p>
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
              Choose your colors
            </h1>
            <p className="lg:text-base text-sm font-semibold">Presets</p>
            <div className="w-full grid grid-cols-6 gap-2 max-w-xs">
              <Button
                variant={"outline"}
                onClick={() => {
                  setPresetChosen(0);
                  setOptions((prev) => ({
                    ...prev,
                    dotsOptions: {
                      ...prev?.dotsOptions,
                      color: "#000",
                    },
                    backgroundOptions: {
                      ...prev?.backgroundOptions,
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
                      ...prev?.dotsOptions,
                      color: "#DE3121",
                    },
                    backgroundOptions: {
                      ...prev?.backgroundOptions,
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
                      ...prev?.dotsOptions,
                      color: "#EF8000",
                    },
                    backgroundOptions: {
                      ...prev?.backgroundOptions,
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
                      ...prev?.dotsOptions,
                      color: "#198639",
                    },
                    backgroundOptions: {
                      ...prev?.backgroundOptions,
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
                      ...prev?.dotsOptions,
                      color: "#229CE0",
                    },
                    backgroundOptions: {
                      ...prev?.backgroundOptions,
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
                      ...prev?.dotsOptions,
                      color: "#6B52D1",
                    },
                    backgroundOptions: {
                      ...prev?.backgroundOptions,
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
              label="Code Color"
              value={options.dotsOptions?.color || "#000"}
              onChange={(v) => {
                setPresetChosen(undefined);
                setOptions((prev) => ({
                  ...prev,
                  dotsOptions: { ...prev?.dotsOptions, color: v },
                }));
              }}
            />
            <InputColor
              className="w-full"
              onBlur={() => {}}
              label="Background Color"
              value={options.backgroundOptions?.color || "#ffffff"}
              onChange={(v) => {
                setPresetChosen(undefined);
                setOptions((prev) => ({
                  ...prev,
                  backgroundOptions: { ...prev?.backgroundOptions, color: v },
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
                  Add a logo
                  <LockIcon className="w-4! h-4!" />
                </HoverCardTrigger>
                <HoverCardContent align="end" asChild>
                  <div className="w-full max-w-[300px] p-2! px-3! rounded bg-primary text-primary-foreground flex flex-col gap-0 items-start text-xs cursor-help">
                    <p className="text-sm font-bold">Unlock adding logos</p>
                    <p>
                      <Link
                        className="underline hover:cursor-pointer"
                        href={`/dashboard/subscription`}
                      >
                        Upgrade
                      </Link>{" "}
                      to be able to add logos to your QR Codes.
                    </p>
                  </div>
                </HoverCardContent>
              </HoverCard>
            ) : (
              <h1 className="lg:text-2xl md:text-xl sm:text-lg text-base font-bold">
                Add a logo
              </h1>
            )}
            <p className="lg:text-base text-sm font-semibold">
              Choose a picture to place in the middle of your QR Code
            </p>
            <div className="w-full flex flex-col gap-1 items-start sm:max-w-sm">
              <div className="w-full flex flex-row items-center gap-1 sm:max-w-sm">
                <Input
                  ref={logoRef}
                  disabled={(plan != "pro" && plan != "plus") || uploading}
                  onChange={handleChange}
                  type="file"
                  className="grow"
                />
                {uploading && (
                  <Button variant={"secondary"} disabled>
                    <Loader2 className="animate-spin" />
                    Uploading
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
                    Remove logo
                  </Button>
                )}
              </div>

              <p className="text-muted-foreground font-light text-xs">
                PNG, JPG, or SVG. Max 5 MB. Transparent PNG recommended for best
                results.
              </p>
            </div>
          </div>
          <div className="flex flex-row items-center justify-between mt-4">
            <Button
              onClick={() => {
                if (options.image) {
                  deletePicture(options.image);
                }
                router.push(`/dashboard/qr-codes`);
              }}
              variant={"secondary"}
            >
              Cancel
            </Button>
            <Button
              onClick={async () => {
                setCreating(true);
                const response = await updateQRCodeOptions(
                  qrCode.qrCodeId,
                  options,
                );
                if (response.success) {
                  router.push(`/dashboard/qr-codes/${qrCode.qrCodeId}/details`);
                  return;
                }
                setCreating(false);
              }}
              disabled={creating}
              variant={"default"}
            >
              {creating ? (
                <>
                  <Loader2 className="animate-spin" /> Saving...
                </>
              ) : (
                <>Save changes</>
              )}
            </Button>
          </div>
        </div>
      </div>
      <div className="w-full max-w-xs lg:flex hidden flex-col gap-4 items-center text-center">
        <p className="font-semibold text-muted-foreground lg:text-lg text-base">
          Preview
        </p>
        <div className="w-full h-auto max-w-52 aspect-square bg-background p-4 flex flex-col">
          <StyledQRCode className="w-full" options={options} />
        </div>
        <p className="text-xs text-muted-foreground">
          This code is preview only, so don&apos;t copy it just yet.
          <br /> Your code will be generated once you finish creating it.
        </p>
      </div>
    </div>
  );
};
