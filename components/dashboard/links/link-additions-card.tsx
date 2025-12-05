"use client";

import { Button } from "@/components/ui/button";
import { Popover, PopoverTrigger } from "@/components/ui/popover";
import { ScrollPopoverContent } from "@/components/ui/scroll-popover-content";
import { StyledQRCode } from "@/components/ui/styled-qr-code";
import { Link } from "@/i18n/navigation";
import { fetchApi } from "@/lib/utils";
import { IQRCode } from "@/models/url/QRCodeV2";
import { IUrl } from "@/models/url/UrlV3";
import {
  ChartNoAxesColumn,
  Download,
  Ellipsis,
  ImagePlus,
  LockIcon,
  NotepadText,
  Palette,
} from "lucide-react";
import Image from "next/image";
import QRCodeStyling, { Options } from "qr-code-styling";
import { useEffect, useMemo, useState } from "react";
import { AddToBioPageDialog } from "@/components/dashboard/links/add-to-bio-page-dialog";

export const LinkAdditionsCard = ({
  qrCode,
  url,
  subscription,
}: {
  qrCode: IQRCode | undefined;
  url: IUrl;
  subscription: string;
}) => {
  const isPro = subscription === "pro";
  const [styledCode, setStyledCode] = useState<QRCodeStyling | undefined>(
    undefined,
  );

  const [bioPage, setBioPage] = useState<
    { slug: string; avatar: string | undefined } | undefined
  >(undefined);
  useEffect(() => {
    const fetchBioPageSlug = async () => {
      try {
        const response = await fetchApi<{
          slug: string;
          avatar: string | undefined;
        }>(`pages/slug-by-url/${url.urlCode}`, {
          method: "GET",
        });
        console.log("Bio page slug response:", response);
        if (response.success && response.slug) {
          setBioPage({ slug: response.slug, avatar: response.avatar });
        } else {
          setBioPage(undefined);
        }
      } catch (error) {
        console.error("Failed to fetch bio page slug:", error);
      }
    };
    fetchBioPageSlug();
  }, [url.urlCode]);

  const qrOptions: Partial<Options> = useMemo(() => {
    return qrCode
      ? qrCode.options
      : {
          type: "svg",
          data: "https://shortn.at",
          dotsOptions: {
            color: "#d3d3d3",
            type: "rounded",
          },
          backgroundOptions: {
            color: "#ffffff",
          },
          imageOptions: {
            crossOrigin: "anonymous",
          },
        };
  }, [qrCode]);

  return (
    <div className="lg:p-6 sm:p-4 p-3 rounded bg-background shadow w-full flex xs:flex-row xs:items-start items-center flex-col gap-8">
      <div className="flex-1 w-full flex flex-col items-start gap-4">
        <h1 className="font-bold lg:text-xl md:text-lg text-base w-full md:text-left text-center">
          QR Code
        </h1>
        <div className="w-full flex md:flex-row flex-col justify-start gap-4 md:items-start items-center">
          <div className="p-2 rounded border w-full max-w-36 h-auto aspect-square">
            <StyledQRCode
              setStyledCode={setStyledCode}
              options={qrOptions}
              className="w-full h-auto aspect-square relative!"
            />
          </div>
          <div className="w-full flex flex-row items-center gap-2 md:justify-start justify-center">
            {qrCode ? (
              <>
                <Button variant={"outline"} asChild>
                  <Link href={`/dashboard/qr-codes/${qrCode.qrCodeId}/details`}>
                    <ChartNoAxesColumn />
                    View details
                  </Link>
                </Button>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant={"outline"} className="p-2! aspect-square!">
                      <Ellipsis />
                    </Button>
                  </PopoverTrigger>
                  <ScrollPopoverContent className="w-[200px] flex flex-col px-0! py-1 gap-1">
                    <Button
                      variant={"outline"}
                      asChild
                      className="w-full border-none! rounded-none! justify-start! shadow-none! "
                    >
                      <Link
                        href={`/dashboard/qr-codes/${qrCode.qrCodeId}/edit/customize`}
                      >
                        <Palette /> Customize
                      </Link>
                    </Button>
                    <Button
                      onClick={() => {
                        styledCode?.download({
                          name: `${qrCode.qrCodeId}`,
                          extension: "png",
                        });
                      }}
                      variant={"outline"}
                      className="w-full border-none! rounded-none! justify-start! shadow-none! "
                    >
                      <Download />
                      Download
                    </Button>
                  </ScrollPopoverContent>
                </Popover>
              </>
            ) : (
              <Button asChild variant={"outline"}>
                <Link
                  href={`/dashboard/qr-codes/create?dynamic_id=${url.urlCode}`}
                >
                  <ChartNoAxesColumn />
                  Create QR Code
                </Link>
              </Button>
            )}
          </div>
        </div>
      </div>
      <div className="flex-1 w-full flex flex-col items-start gap-4">
        <h1 className="font-bold lg:text-xl md:text-lg text-base w-full md:text-left text-center">
          Shortn Page
        </h1>
        <div className="w-full flex md:flex-row flex-col justify-start gap-4 md:items-start items-center">
          <div className="p-2 rounded-full bg-muted border w-full max-w-36 h-auto aspect-square flex items-center justify-center">
            {bioPage ? (
              bioPage.avatar ? (
                <Image
                  src={bioPage.avatar}
                  alt="Avatar"
                  width={128}
                  height={128}
                  className="w-full h-auto aspect-square rounded-full"
                />
              ) : (
                <ImagePlus className="w-8 h-8 text-muted-foreground" />
              )
            ) : (
              <NotepadText className="w-8 h-8 text-muted-foreground" />
            )}
          </div>
          <div className="w-full flex flex-row items-center gap-2 md:justify-start justify-center">
            {bioPage ? (
              <Button variant={"outline"} asChild>
                <Link href={`/dashboard/pages/${bioPage.slug}/customize`}>
                  <ChartNoAxesColumn />
                  View page
                </Link>
              </Button>
            ) : isPro ? (
              <AddToBioPageDialog
                linkId={url._id as string}
                linkTitle={url.title || "Link"}
                onSuccess={(slug) => {
                  setBioPage({ slug, avatar: undefined });
                  // Fetch the updated avatar
                  fetchApi<{
                    slug: string;
                    avatar: string | undefined;
                  }>(`pages/slug-by-url/${url.urlCode}`, {
                    method: "GET",
                  }).then((response) => {
                    if (response.success && response.slug) {
                      setBioPage({
                        slug: response.slug,
                        avatar: response.avatar,
                      });
                    }
                  });
                }}
                trigger={
                  <Button variant={"outline"}>
                    <NotepadText className="h-4 w-4 mr-2" />
                    Add to a page
                  </Button>
                }
              />
            ) : (
              <Button variant={"outline"} asChild>
                <Link href="/dashboard/subscription">
                  <LockIcon className="h-4 w-4 mr-2" />
                  Upgrade to Pro
                </Link>
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
