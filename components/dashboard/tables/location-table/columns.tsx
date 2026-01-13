"use client";

import { Button } from "@/components/ui/button";
import { ClickEntry } from "@/models/url/Click";
import { ColumnDef } from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";

export function aggregateClicksByLocation(
  entries: ClickEntry[],
  level: "country" | "city" | "device" | "browser" | "os" = "country",
  unknownLabel: string = "Unknown",
) {
  const total = entries.length;
  const counts: Record<string, number> = {};

  for (const entry of entries) {
    let key: string;

    switch (level) {
      case "city":
        key = entry.city?.trim() || `${unknownLabel} City`;
        break;
      case "device":
        key = entry.deviceType?.trim() || `${unknownLabel} Device`;
        break;
      case "browser":
        key = entry.browser?.trim() || `${unknownLabel} Browser`;
        break;
      case "os":
        key = entry.os?.trim() || `${unknownLabel} OS`;
        break;
      case "country":
      default:
        key = entry.country?.trim() || `${unknownLabel} Country`;
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

export const locationColumns = (
  title: string,
  clicks: string,
): ColumnDef<LocationStats>[] => [
  {
    id: "location",
    accessorKey: "location",
    enableResizing: true,
    filterFn: (row, _columnId, filterValue) => {
      if (filterValue === "__HIDE_UNKNOWN__") {
        // Check if location contains "Unknown" pattern (works for any language)
        return !row.original.location.toLowerCase().includes("unknown");
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
          {title}
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
      <div className="w-full truncate capitalize">{row.original.location}</div>
    ),
  },
  {
    id: "clicks",
    accessorKey: "clicks",
    enableResizing: true,
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
          className="flex items-center ml-auto w-fit!"
        >
          {clicks}
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
    enableResizing: true,
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
          className="flex items-center ml-auto w-fit!"
        >
          %
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
