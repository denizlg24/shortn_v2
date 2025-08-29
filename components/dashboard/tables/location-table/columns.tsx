"use client";

import { Button } from "@/components/ui/button";
import { ClickEntry } from "@/models/url/UrlV3";
import { ColumnDef } from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";

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
    size: 1000,
    filterFn: (row, _columnId, filterValue) => {
      if (filterValue === "__HIDE_UNKNOWN__") {
        return (
          row.original.location !== "Unknown Country" &&
          row.original.location !== "Unknown Region" &&
          row.original.location !== "Unknown City"
        );
      }
      if (typeof filterValue === "string" && filterValue.trim().length > 0) {
        return row.original.location
          .toLowerCase()
          .includes(filterValue.toLowerCase());
      }
      return true;
    },
    header: ({ column }) => {
      const sortState = column.getIsSorted();

      const handleClick = () => {
        if (!sortState) {
          column.toggleSorting(false);
        } else if (sortState === "asc") {
          column.toggleSorting(true);
        } else {
          column.clearSorting();
        }
      };

      return (
        <Button
          variant="ghost"
          onClick={handleClick}
          className="flex items-center w-fit!"
        >
          Location
          {sortState === "asc" ? (
            <ArrowUp className=" h-4 w-4" />
          ) : sortState === "desc" ? (
            <ArrowDown className=" h-4 w-4" />
          ) : (
            <ArrowUpDown className=" h-4 w-4 opacity-50" />
          )}
        </Button>
      );
    },
    cell: ({ row }) => (
      <div className="w-full truncate">{row.original.location}</div>
    ),
  },
  {
    id: "clicks",
    accessorKey: "clicks",
    size: 84,
    maxSize: 84,
    minSize: 84,
    header: ({ column }) => {
      const sortState = column.getIsSorted();

      const handleClick = () => {
        if (!sortState) {
          column.toggleSorting(false);
        } else if (sortState === "asc") {
          column.toggleSorting(true);
        } else {
          column.clearSorting();
        }
      };

      return (
        <Button
          variant="ghost"
          onClick={handleClick}
          className="flex items-center justify-end w-fit!"
        >
          Clicks
          {sortState === "asc" ? (
            <ArrowUp className=" h-4 w-4" />
          ) : sortState === "desc" ? (
            <ArrowDown className=" h-4 w-4" />
          ) : (
            <ArrowUpDown className=" h-4 w-4 opacity-50" />
          )}
        </Button>
      );
    },
    cell: ({ row }) => {
      const value = row.original.clicks;
      return (
        <div className="flex items-center gap-2 w-full">
          <span className="w-full text-right">{value}</span>
        </div>
      );
    },
  },
  {
    id: "percentage",
    accessorKey: "percentage",
    size: 112,
    maxSize: 112,
    header: ({ column }) => {
      const sortState = column.getIsSorted();

      const handleClick = () => {
        if (!sortState) {
          column.toggleSorting(false);
        } else if (sortState === "asc") {
          column.toggleSorting(true);
        } else {
          column.clearSorting();
        }
      };

      return (
        <Button
          variant="ghost"
          onClick={handleClick}
          className="flex items-center justify-end w-fit!"
        >
          % of Total
          {sortState === "asc" ? (
            <ArrowUp className=" h-4 w-4" />
          ) : sortState === "desc" ? (
            <ArrowDown className=" h-4 w-4" />
          ) : (
            <ArrowUpDown className=" h-4 w-4 opacity-50" />
          )}
        </Button>
      );
    },
    cell: ({ row }) => {
      const value = row.original.percentage;
      return (
        <div className="flex items-center gap-2 w-full">
          <span className="w-full text-right">{value.toFixed(1)}%</span>
        </div>
      );
    },
  },
];
