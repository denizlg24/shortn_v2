"use client";

import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { StyledQRCode } from "@/components/ui/styled-qr-code";
import { Link } from "@/i18n/navigation";
import { IQRCode } from "@/models/url/QRCodeV2";
import { IUrl } from "@/models/url/UrlV3";
import { useUser } from "@/utils/UserContext";
import {
  ChartNoAxesColumn,
  Download,
  Ellipsis,
  NotepadText,
  Palette,
} from "lucide-react";

export const LinkAdditionsCard = ({
  qrCode,
  url,
}: {
  qrCode: IQRCode | undefined;
  url: IUrl;
}) => {
  const session = useUser();

  const handleDownload = (base64: string, filename: string) => {
    const link = document.createElement("a");
    link.href = base64;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="lg:p-6 sm:p-4 p-3 rounded bg-background shadow w-full flex xs:flex-row xs:items-start items-center flex-col gap-8">
      <div className="flex-1 w-full flex flex-col items-start gap-4">
        <h1 className="font-bold lg:text-xl md:text-lg text-base w-full md:text-left text-center">
          QR Code
        </h1>
        <div className="w-full flex md:flex-row flex-col justify-start gap-4 md:items-start items-center">
          <div className="p-2 rounded border w-full max-w-36 h-auto aspect-square">
            <StyledQRCode
              options={
                qrCode
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
                    }
              }
              className="w-full h-auto aspect-square relative!"
            />
          </div>
          <div className="w-full flex flex-row items-center gap-2 md:justify-start justify-center">
            {qrCode ? (
              <>
                <Button variant={"outline"} asChild>
                  <Link
                    href={`/dashboard/${
                      session.user?.sub.split("|")[0]
                    }/qr-codes/${qrCode.qrCodeId}/details`}
                  >
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
                  <PopoverContent className="w-[200px] flex flex-col px-0! py-1 gap-1">
                    <Button
                      variant={"outline"}
                      asChild
                      className="w-full border-none! rounded-none! justify-start! shadow-none! "
                    >
                      <Link
                        href={`/dashboard/${
                          session.user?.sub.split("|")[0]
                        }/qr-codes/${qrCode.qrCodeId}/edit/customize`}
                      >
                        <Palette /> Customize
                      </Link>
                    </Button>
                    <Button
                      onClick={() => {
                        handleDownload(
                          qrCode.qrCodeBase64,
                          `${qrCode.qrCodeId}.png`
                        );
                      }}
                      variant={"outline"}
                      className="w-full border-none! rounded-none! justify-start! shadow-none! "
                    >
                      <Download />
                      Download
                    </Button>
                  </PopoverContent>
                </Popover>
              </>
            ) : (
              <Button asChild variant={"outline"}>
                <Link
                  href={`/dashboard/${
                    session.user?.sub.split("|")[1]
                  }/qr-codes/create?dynamic_id=${url.urlCode}`}
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
            <NotepadText className="w-8 h-8 text-muted-foreground" />
          </div>
          <div className="w-full flex flex-row items-center gap-2 md:justify-start justify-center">
            <Button variant={"outline"}>
              <NotepadText />
              Add to a page
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
