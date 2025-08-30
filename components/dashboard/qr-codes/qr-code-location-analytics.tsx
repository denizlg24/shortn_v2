import { IUrl } from "@/models/url/UrlV3";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { Button } from "@/components/ui/button";
import { Earth, Lock, MapPinned } from "lucide-react";
import { Link } from "@/i18n/navigation";
import scansOverTimeLocked from "@/public/scans-over-time-upgrade.png";
import Image from "next/image";
import { useState } from "react";
import { DataTable } from "../tables/location-table/data-table";
import { aggregateClicksByLocation } from "../tables/location-table/columns";
import { CardDescription, CardTitle } from "@/components/ui/card";
import countries from "i18n-iso-countries";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
// Load locales you need
import en from "i18n-iso-countries/langs/en.json";
import { IQRCode } from "@/models/url/QRCodeV2";
import { locationColumns } from "./qr-code-location-columns";

export const QRCodeLocationAnalytics = ({
  unlocked,
  linkData,
}: {
  unlocked: boolean;
  linkData: IQRCode;
}) => {
  const [selected, setSelected] = useState<"country" | "city" | "region">(
    "country"
  );
  countries.registerLocale(en);

  if (!unlocked) {
    return (
      <div className="lg:p-6 sm:p-4 p-3 rounded bg-background shadow w-full flex flex-col gap-0">
        <div className="flex xs:flex-row flex-col xs:gap-0 gap-2 items-center justify-between w-full">
          <h1 className="font-bold md:text-lg text-base truncate">
            Location data
          </h1>
          <HoverCard>
            <HoverCardTrigger asChild>
              <Button className="xs:rounded-xl! p-1! px-2! h-fit! rounded! text-xs xs:w-fit w-full hover:cursor-help">
                <Lock />
                Upgrade
              </Button>
            </HoverCardTrigger>
            <HoverCardContent asChild>
              <div className="w-full max-w-[300px] p-2! px-3! rounded bg-primary text-primary-foreground flex flex-col gap-0 items-start text-xs cursor-help">
                <p className="w-full">
                  <Link
                    href={`/dashboard/subscription`}
                    className="underline hover:cursor-pointer"
                  >
                    Upgrade
                  </Link>{" "}
                  to see location data.
                </p>
              </div>
            </HoverCardContent>
          </HoverCard>
        </div>
        <div className="w-full h-auto">
          <Image
            src={scansOverTimeLocked}
            alt="Scans over time locked illustration"
            className="w-full h-full object-cover  min-h-[150px]"
          />
        </div>
      </div>
    );
  }

  const transformed = linkData.clicks.all.map((click) => ({
    ...click,
    country: click.country ? countries.getName(click.country, "en") : undefined,
  }));

  const data = aggregateClicksByLocation(transformed, selected);

  return (
    <div className="lg:p-6 sm:p-4 p-3 rounded bg-background shadow w-full flex flex-col gap-4">
      <div className="w-full flex flex-col gap-1 items-start">
        <CardTitle>Location data</CardTitle>
        <CardDescription>
          Showing location data of qr code's scans
        </CardDescription>
      </div>
      <div className="w-full flex flex-col gap-2">
        <Tabs
          value={selected}
          onValueChange={(e) => {
            setSelected(e as "country" | "city" | "region");
          }}
        >
          <TabsList className="w-full sm:max-w-sm">
            <TabsTrigger value="country">
              <Earth />
              Countries
            </TabsTrigger>
            <TabsTrigger value="city">
              <MapPinned />
              Cities
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <DataTable data={data} columns={locationColumns} />
      </div>
    </div>
  );
};
