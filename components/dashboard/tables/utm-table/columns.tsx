import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ColumnDef } from "@tanstack/react-table";
import { format } from "date-fns";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";

export interface UtmStats {
  timestamp: Date;
  utm_campaign?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_term?: string;
  utm_content?: string;
}

export const utmColumns = (): ColumnDef<UtmStats>[] => [
  {
    id: "timestamp",
    accessorKey: "timestamp",
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
        <Button variant="ghost" onClick={handleClick} className="flex w-fit!">
          Timestamp
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
      <div className="w-full truncate capitalize">
        {format(row.original.timestamp, "dd-MM-yyyy, HH:mm")}
      </div>
    ),
  },
  {
    id: "utm_campaign",
    accessorKey: "utm_campaign",
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
        <Button variant="ghost" onClick={handleClick} className="flex w-fit!">
          Campaign
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
      const value = row.original.utm_campaign;
      return (
        <div className={cn("flex gap-2 w-full")}>
          <span className="w-full ">{value ?? "-"}</span>
        </div>
      );
    },
  },
  {
    id: "utm_source",
    accessorKey: "utm_source",
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
        <Button variant="ghost" onClick={handleClick} className="flex w-fit!">
          Source
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
      const value = row.original.utm_source;
      return (
        <div className={cn("flex gap-2 w-full")}>
          <span className="w-full ">{value ?? "-"}</span>
        </div>
      );
    },
  },
  {
    id: "utm_medium",
    accessorKey: "utm_medium",
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
        <Button variant="ghost" onClick={handleClick} className="flex w-fit!">
          Medium
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
      const value = row.original.utm_medium;
      return (
        <div className={cn("flex gap-2 w-full")}>
          <span className="w-full ">{value ?? "-"}</span>
        </div>
      );
    },
  },
  {
    id: "utm_term",
    accessorKey: "utm_term",
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
        <Button variant="ghost" onClick={handleClick} className="flex w-fit!">
          Term
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
      const value = row.original.utm_term;
      return (
        <div className={cn("flex gap-2 w-full")}>
          <span className="w-full ">{value ?? "-"}</span>
        </div>
      );
    },
  },
  {
    id: "utm_content",
    accessorKey: "utm_content",
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
        <Button variant="ghost" onClick={handleClick} className="flex w-fit!">
          Content
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
      const value = row.original.utm_content;
      return (
        <div className={cn("flex gap-2 w-full")}>
          <span className="w-full ">{value ?? "-"}</span>
        </div>
      );
    },
  },
];
