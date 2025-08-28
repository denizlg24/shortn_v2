"use client";

import { ClickEntry } from "@/models/url/UrlV3";
import { ColumnDef } from "@tanstack/react-table";

export function aggregateClicksByLocation(
  entries: ClickEntry[],
  level: "country" | "region" | "city" = "country"
) {
  const total = entries.length;
  const counts: Record<string, number> = {};

  for (const entry of entries) {
    let key: string;

    switch (level) {
      case "city":
        key = entry.city?.trim() || "Unknown City";
        break;
      case "region":
        key = entry.region?.trim() || "Unknown Region";
        break;
      case "country":
      default:
        key = entry.country?.trim() || "Unknown Country";
        break;
    }

    counts[key] = (counts[key] ?? 0) + 1;
  }

  return Object.entries(counts)
    .map(([location, clicks]) => ({
      location,
      clicks,
      percentage: total > 0 ? (clicks / total) * 100 : 0,
    }))
    .sort((a, b) => b.clicks - a.clicks);
}

export interface LocationStats {
  location: string;
  clicks: number;
  percentage: number;
}

export const locationColumns: ColumnDef<LocationStats>[] = [
  {
    id: "location",
    accessorKey: "location",
    header: "Location",
  },
  {
    id: "clicks",
    accessorKey: "clicks",
    header: "Clicks",
  },
  {
    id: "percentage",
    accessorKey: "percentage",
    header: "% of Total",
    cell: ({ row }) => {
      const value = row.original.percentage;
      return (
        <div className="flex items-center gap-2 w-full">
          <span className="min-w-[40px] text-right">{value.toFixed(1)}%</span>
        </div>
      );
    },
  },
];
