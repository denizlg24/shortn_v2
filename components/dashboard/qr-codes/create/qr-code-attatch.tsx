"use client";

import { attachQRToShortn } from "@/app/actions/linkActions";
import { createQrCode } from "@/app/actions/qrCodeActions";
import { Button } from "@/components/ui/button";
import InputColor from "@/components/ui/color-input";
import { StyledQRCode } from "@/components/ui/styled-qr-code";
import { useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { IUrl } from "@/models/url/UrlV3";
import { useUser } from "@/utils/UserContext";
import { Loader2, LucideLink } from "lucide-react";
import { Options } from "qr-code-styling";
import { useState } from "react";

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
import { getLinksLeft } from "../../home/quick-create";
export const QRCodeAttach = ({ linkToAttach }: { linkToAttach: IUrl }) => {
  const session = useUser();

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

  const [presetChosen, setPresetChosen] = useState<number | undefined>(0);

  const [creating, setCreating] = useState(false);

  const [error, setError] = useState("");

  return (
    <div className="w-full flex flex-row items-start justify-between gap-4 col-span-full">
      <div className="w-full flex flex-col gap-6 items-start">
        <div className="flex flex-col gap-1 w-full items-start">
          <div className="w-full flex flex-row items-center justify-between">
            <h1 className="font-bold lg:text-3xl md:text-2xl sm:text-xl text-lg">
              Attach a QR Code
            </h1>
            <div className="bg-muted-foreground/25 p-2 flex rounded flex-row items-center gap-2 shadow text-primary font-bold xs:text-sm text-xs">
              <LucideLink className="h-4 w-4" />
              <p>{linkToAttach.shortUrl.split("//")[1]}</p>
            </div>
          </div>
          {getLinksLeft(
            session.user?.plan.subscription ?? "free",
            session.user?.qr_codes_this_month ?? 0,
            true,
            "text-xs"
          )}
        </div>
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
                    "border-2 border-primary"
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
                    "border-2 border-primary"
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
                    "border-2 border-primary"
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
                    "border-2 border-primary"
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
                    "border-2 border-primary"
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
                      "border-2 border-primary"
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
                    "border-2 border-primary"
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
                    "border-2 border-primary"
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
                    "border-2 border-primary"
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
                    "border-2 border-primary"
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
                    "border-2 border-primary"
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
                    "border-2 border-primary"
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
                    "border-2 border-primary"
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
                    "border-2 border-primary"
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
                    "border-2 border-primary"
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
                    "border-2 border-primary"
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
                    "border-2 border-primary"
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
                    "border-2 border-primary"
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
                  dotsOptions: { ...prev.dotsOptions, color: v },
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
                  backgroundOptions: { ...prev.backgroundOptions, color: v },
                }));
              }}
            />
          </div>
          {error && (
            <p className="xs:text-sm text-xs font-bold text-destructive -mb-6 mt-2">
              {error}
            </p>
          )}
          <div className="flex flex-row items-center justify-between mt-4">
            <Button variant={"secondary"}>Cancel</Button>
            <Button
              onClick={async () => {
                setCreating(true);
                const qrCodeResponse = await createQrCode({
                  longUrl: linkToAttach.longUrl,
                  title: linkToAttach.title,
                  tags: linkToAttach.tags?.map((t) => t.id),
                  attachedUrl: linkToAttach.urlCode,
                  options,
                });
                if (!qrCodeResponse.success) {
                  switch (qrCodeResponse.message) {
                    case "no-user":
                      setError("User session error.");
                      setCreating(false);
                      return;
                    case "plan-limit":
                      setError("You have reached your plan's QR Code limit.");
                      setCreating(false);
                      return;
                    default:
                      setError("There was a problem creating your QR Code.");
                      setCreating(false);
                      return;
                  }
                }
                if (qrCodeResponse.success && qrCodeResponse.data) {
                  const updateResponse = await attachQRToShortn(
                    linkToAttach.urlCode,
                    qrCodeResponse.data.qrCodeId
                  );
                  if (!updateResponse.success) {
                    setError("There was a problem creating your QR Code.");
                    setCreating(false);
                    return;
                  }
                  if (updateResponse.success) {
                    router.push(
                      `/dashboard/links/${linkToAttach.urlCode}/details`
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
                  <Loader2 className="animate-spin" /> Creating...
                </>
              ) : (
                <>Create your code</>
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
