import { IUrl } from "@/models/url/UrlV3";

import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";

import {
  AppWindowMac,
  Earth,
  Globe,
  Lock,
  MapPinned,
  MonitorSmartphone,
} from "lucide-react";
import { Link } from "@/i18n/navigation";
import scansOverTimeLocked from "@/public/scans-over-time-upgrade.png";
import Image from "next/image";
import { useState } from "react";

import { DataTable } from "../tables/location-table/data-table";
import {
  aggregateClicksByLocation,
  locationColumns,
} from "../tables/location-table/columns";
import { CardDescription, CardTitle } from "@/components/ui/card";
import countries from "i18n-iso-countries";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
// Load locales you need
import en from "i18n-iso-countries/langs/en.json";

export function getDataTitle(
  selected: "country" | "city" | "device" | "browser" | "os"
) {
  switch (selected) {
    case "country":
      return "Country";
    case "city":
      return "City";
    case "device":
      return "Device";
    case "browser":
      return "Browser";
    case "os":
      return "OS";
  }
}

export const LinkLocationAnalytics = ({
  unlocked,
  linkData,
}: {
  unlocked: "none" | "location" | "all";
  linkData: IUrl;
}) => {
  const [selected, setSelected] = useState<
    "country" | "city" | "device" | "browser" | "os"
  >("country");
  countries.registerLocale(en);

  if (unlocked == "none") {
    return (
      <div className="lg:p-6 sm:p-4 p-3 rounded bg-background shadow w-full flex flex-col gap-0">
        <div className="flex xs:flex-row flex-col xs:gap-0 gap-2 items-center justify-between w-full">
          <h1 className="font-bold md:text-lg text-base truncate">
            Advanced data
          </h1>
          <HoverCard>
            <HoverCardTrigger className="xs:rounded-xl! bg-primary flex flex-row items-center text-primary-foreground p-1! px-2! h-fit! rounded! text-xs gap-2 font-semibold xs:w-fit w-full hover:cursor-help">
              <Lock className="w-4 h-4" />
              Upgrade
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
                  to see advanced data.
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
        <CardTitle>Advanced data</CardTitle>
        <CardDescription>
          Showing advanced data of short link&apos;s clicks
        </CardDescription>
      </div>
      <div className="w-full flex flex-col gap-2">
        <Tabs
          value={selected}
          onValueChange={(e) => {
            setSelected(e as "country" | "city" | "device" | "browser" | "os");
          }}
        >
          <TabsList className="w-full sm:max-w-md">
            <TabsTrigger className="h-fit!" value="country">
              <Earth />
              Countries
            </TabsTrigger>
            <TabsTrigger className="h-fit!" value="city">
              <MapPinned />
              Cities
            </TabsTrigger>
            <TabsTrigger
              disabled={unlocked == "location"}
              className="h-fit! relative sm:flex hidden"
              value="device"
            >
              <MonitorSmartphone />
              Device
              {unlocked == "location" && (
                <Lock className="w-3! h-3! absolute -top-2 -right-2" />
              )}
            </TabsTrigger>
            <TabsTrigger
              disabled={unlocked == "location"}
              className="h-fit! relative sm:flex hidden"
              value="browser"
            >
              <Globe />
              Browser
              {unlocked == "location" && (
                <Lock className="w-3! h-3! absolute -top-2 -right-2" />
              )}
            </TabsTrigger>
            <TabsTrigger
              disabled={unlocked == "location"}
              className="h-fit! relative sm:flex hidden"
              value="os"
            >
              <AppWindowMac />
              OS
              {unlocked == "location" && (
                <Lock className="w-3! h-3! absolute -top-2 -right-2" />
              )}
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <Tabs
          value={selected}
          onValueChange={(e) => {
            setSelected(e as "device" | "browser" | "os");
          }}
        >
          <TabsList className="w-full sm:hidden flex">
            <TabsTrigger
              disabled={unlocked == "location"}
              className="h-fit! relative"
              value="device"
            >
              <MonitorSmartphone />
              Device
              {unlocked == "location" && (
                <Lock className="w-3! h-3! absolute -top-2 -right-2" />
              )}
            </TabsTrigger>
            <TabsTrigger
              disabled={unlocked == "location"}
              className="h-fit! relative"
              value="browser"
            >
              <Globe />
              Browser
              {unlocked == "location" && (
                <Lock className="w-3! h-3! absolute -top-2 -right-2" />
              )}
            </TabsTrigger>
            <TabsTrigger
              disabled={unlocked == "location"}
              className="h-fit! relative"
              value="os"
            >
              <AppWindowMac />
              OS
              {unlocked == "location" && (
                <Lock className="w-3! h-3! absolute -top-2 -right-2" />
              )}
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <DataTable
          data={data}
          columns={locationColumns(getDataTitle(selected), "Click")}
        />
      </div>
    </div>
  );
};
