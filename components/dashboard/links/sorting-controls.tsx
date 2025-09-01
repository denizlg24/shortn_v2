"use client";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { usePathname, useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { useSearchParams } from "next/navigation";

export const SortingControls = ({
  label,
  className,
}: {
  label: string;
  className?: string;
}) => {
  const searchParams = useSearchParams();
  const sort = searchParams.get("sortBy") || "date_desc";
  const pathname = usePathname();
  const router = useRouter();

  const setSort = (value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("sortBy", value);
    router.push(`${pathname}?${params.toString()}`);
  };

  return (
    <div className={cn("w-full flex flex-row gap-2 items-center", className)}>
      <Label className="w-max">{label}</Label>
      <Select value={sort} onValueChange={setSort} defaultValue="date_desc">
        <SelectTrigger className="w-[180px] bg-background">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="date_desc">Most recent first</SelectItem>
          <SelectItem value="date_asc">Oldest first</SelectItem>
          <SelectItem value="clicks_desc">Best performing first</SelectItem>
          <SelectItem value="clicks_asc">Worst performing first</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
};
