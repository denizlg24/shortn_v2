"use client";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import {
  CalendarIcon,
  Check,
  ChevronsUpDown,
  Search,
  Settings2,
  X,
} from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { DateRange } from "react-day-picker";

export const LinkFilterBar = () => {
  const [open, setOpen] = useState(false);
  const [moreFiltersOpen, setMoreFiltersOpen] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [tags, setTags] = useState("");

  const router = useRouter();
  const searchParams = useSearchParams();

  // === Local state for filters ===
  const [query, setQuery] = useState(searchParams.get("query") || "");
  const [customLink, setCustomLink] = useState(
    searchParams.get("customLink") || "all"
  );
  const [attachedQR, setAttachedQR] = useState(
    searchParams.get("attachedQR") || "all"
  );
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: searchParams.get("startDate")
      ? new Date(searchParams.get("startDate")!)
      : undefined,
    to: searchParams.get("endDate")
      ? new Date(searchParams.get("endDate")!)
      : undefined,
  });

  const applyFilters = () => {
    const params = new URLSearchParams();

    if (query) params.set("query", query);
    if (customLink !== "all") params.set("customLink", customLink);
    if (attachedQR !== "all") params.set("attachedQR", attachedQR);

    if (dateRange?.from)
      params.set("startDate", format(dateRange.from, "dd-MM-yyyy"));
    if (dateRange?.to)
      params.set("endDate", format(dateRange.to, "dd-MM-yyyy"));

    params.set("page", "1");

    router.push(`?${params.toString()}`);
    setMoreFiltersOpen(false);
    setCalendarOpen(false);
  };

  const clearQuery = () => {
    setQuery("");
    const params = new URLSearchParams();

    if (customLink !== "all") params.set("customLink", customLink);
    if (attachedQR !== "all") params.set("attachedQR", attachedQR);
    if (dateRange?.from)
      params.set("startDate", format(dateRange.from, "dd-MM-yyyy"));
    if (dateRange?.to)
      params.set("endDate", format(dateRange.to, "dd-MM-yyyy"));

    params.set("page", "1");

    router.push(`?${params.toString()}`);
    setMoreFiltersOpen(false);
    setCalendarOpen(false);
  };

  const clearDate = () => {
    setDateRange(undefined);
    const params = new URLSearchParams();

    if (query) params.set("query", query);
    if (customLink !== "all") params.set("customLink", customLink);
    if (attachedQR !== "all") params.set("attachedQR", attachedQR);

    params.set("page", "1");

    router.push(`?${params.toString()}`);
    setMoreFiltersOpen(false);
    setCalendarOpen(false);
  };

  const clearMoreFilters = () => {
    setCustomLink("all");
    setAttachedQR("all");
    const params = new URLSearchParams();

    if (query) params.set("query", query);

    if (dateRange?.from)
      params.set("startDate", format(dateRange.from, "dd-MM-yyyy"));
    if (dateRange?.to)
      params.set("endDate", format(dateRange.to, "dd-MM-yyyy"));

    params.set("page", "1");

    router.push(`?${params.toString()}`);
    setMoreFiltersOpen(false);
    setCalendarOpen(false);
  };

  return (
    <div className="w-full flex md:flex-row flex-col justify-start gap-2 lg:items-center items-start pb-4 border-b-2 relative col-span-full">
      <div className="relative w-full lg:max-w-[375px] md:max-w-[300px]">
        <Input
          type="text"
          name="query"
          id="query"
          placeholder="Search links"
          value={query}
          onChange={(e) => {
            if (e.target.value == "") {
              clearQuery();
              return;
            }
            setQuery(e.target.value);
          }}
          className="bg-background pl-7 w-full"
        />
        <Search className="absolute left-2 top-2.5 z-10 w-4 h-4 text-gray-400" />
        {query && (
          <X
            onClick={clearQuery}
            className="absolute right-2 top-2.5 z-10 w-4 h-4 text-gray-400 hover:cursor-pointer"
          />
        )}
      </div>

      <div className="flex md:flex-row flex-col sm:items-center items-start gap-2 w-full">
        <Dialog open={calendarOpen} onOpenChange={setCalendarOpen}>
          <DialogTrigger asChild>
            <Button
              id="date-picker"
              variant={"outline"}
              className="w-full md:max-w-[200px]! max-w-full"
            >
              <CalendarIcon className="size-3.5" />
              <p className="font-semibold">
                {dateRange?.from && dateRange?.to
                  ? `${format(dateRange.from, "MMM d")} – ${format(
                      dateRange.to,
                      "MMM d"
                    )}`
                  : "Filter by created date"}
              </p>
            </Button>
          </DialogTrigger>
          <DialogContent className="w-full max-w-[300px] overflow-hidden p-0">
            <div className="p-4 w-full">
              <DialogHeader className="text-left">
                <DialogTitle>Filter by created date</DialogTitle>
                <DialogDescription>
                  Display only links created on the selected range.
                </DialogDescription>
              </DialogHeader>
              <Separator className="my-2" />
              <Calendar
                className="w-full max-w-[300px] mx-auto mt-4 p-0"
                mode="range"
                endMonth={new Date()}
                selected={dateRange}
                onSelect={setDateRange}
                disabled={(date) => {
                  return date > new Date();
                }}
              />
              <div className="flex flex-row w-full items-center gap-2 justify-end">
                <Button onClick={clearDate} variant={"ghost"}>
                  <X />
                  Clear Filters
                </Button>
                <Button onClick={applyFilters} variant={"default"}>
                  Apply
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
        <Dialog open={moreFiltersOpen} onOpenChange={setMoreFiltersOpen}>
          <DialogTrigger asChild>
            <Button
              id="filters"
              variant={"outline"}
              className="w-full md:max-w-[120px]! max-w-full"
            >
              <Settings2 className="size-3.5" />
              <p className="font-semibold">Add Filters</p>
            </Button>
          </DialogTrigger>
          <DialogContent className="w-full max-w-[300px] overflow-hidden p-0">
            <div className="p-4 w-full flex flex-col gap-4">
              <DialogHeader className="text-left">
                <DialogTitle>Filters</DialogTitle>
              </DialogHeader>
              <div className="w-full flex flex-col gap-2">
                <Label className="font-semibold">Tags</Label>
                <Popover open={open} onOpenChange={setOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={open}
                      className="w-full justify-between"
                    >
                      {tags || "Select tags..."}
                      <ChevronsUpDown className="opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent
                    align="start"
                    className="w-full min-w-[250px] p-0"
                  >
                    <Command>
                      <CommandInput
                        placeholder="Search tags..."
                        className="h-9"
                      />
                      <CommandList>
                        <CommandEmpty>No options.</CommandEmpty>
                        <CommandGroup>
                          {/*{frameworks.map((framework) => (
                          <CommandItem
                            key={framework.value}
                            value={framework.value}
                            onSelect={(currentValue) => {
                              setValue(
                                currentValue === value ? "" : currentValue
                              );
                              setOpen(false);
                            }}
                          >
                            {framework.label}
                            <Check
                              className={cn(
                                "ml-auto",
                                value === framework.value
                                  ? "opacity-100"
                                  : "opacity-0"
                              )}
                            />
                          </CommandItem>
                        ))}*/}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
              <div className="w-full flex flex-col gap-2">
                <Label className="font-semibold">Link Type</Label>
                <Select
                  value={customLink}
                  onValueChange={setCustomLink}
                  defaultValue="all"
                >
                  <SelectTrigger className="w-full">
                    <SelectValue defaultValue={"all"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="on">
                        Links<span className="font-semibold -mx-1">with</span>
                        custom back-halves
                      </SelectItem>
                      <SelectItem value="off" className="gap-0!">
                        Links
                        <span className="font-semibold -mx-1">without</span>
                        custom back-halves
                      </SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
              <div className="w-full flex flex-col gap-2">
                <Label className="font-semibold">Attached QR Code</Label>
                <Select
                  value={attachedQR}
                  onValueChange={setAttachedQR}
                  defaultValue="all"
                >
                  <SelectTrigger className="w-full">
                    <SelectValue defaultValue={"all"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="all">
                        Links
                        <span className="font-semibold -mx-1">
                          with or without
                        </span>
                        attached QR Codes
                      </SelectItem>
                      <SelectItem value="on">
                        Links
                        <span className="font-semibold -mx-1">with</span>
                        attached QR Codes only
                      </SelectItem>
                      <SelectItem value="off">
                        Links
                        <span className="font-semibold -mx-1">without</span>
                        attached QR Codes only
                      </SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-row w-full items-center gap-2 justify-end">
                <Button onClick={clearMoreFilters} variant={"ghost"}>
                  <X />
                  Clear Filters
                </Button>
                <Button onClick={applyFilters} variant={"default"}>
                  Apply
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
        {query && (
          <Button className="md:w-auto w-full" onClick={applyFilters}>
            Search
          </Button>
        )}
      </div>
    </div>
  );
};
