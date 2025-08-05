"use client";
import { getTagById, getTags, getTagsByQuery } from "@/app/actions/tagActions";
import { Button, buttonVariants } from "@/components/ui/button";
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
import { usePathname, useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { ITag } from "@/models/url/Tag";
import { useUser } from "@/utils/UserContext";
import { format, parse } from "date-fns";
import {
  CalendarIcon,
  Check,
  ChevronsUpDown,
  Search,
  Settings2,
  X,
} from "lucide-react";
import { useSearchParams } from "next/navigation";
import { startTransition, useEffect, useState } from "react";
import { DateRange } from "react-day-picker";

export const QRCodesFilterBar = () => {
  const [open, setOpen] = useState(false);
  const [moreFiltersOpen, setMoreFiltersOpen] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [input, setInput] = useState("");
  const [tagOptions, setTagOptions] = useState<ITag[]>([]);

  const session = useUser();
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  // === Local state for filters ===
  const [query, setQuery] = useState(searchParams.get("query") || "");

  const [attachedQR, setAttachedQR] = useState(
    searchParams.get("attachedQR") || "all"
  );

  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: searchParams.get("startDate")
      ? parse(searchParams.get("startDate")!, "MM-dd-yyyy", new Date())
      : undefined,
    to: searchParams.get("endDate")
      ? parse(searchParams.get("endDate")!, "MM-dd-yyyy", new Date())
      : undefined,
  });

  const [tags, setTags] = useState<ITag[]>([]);

  const readTags = async () => {
    let tagIds: string[] = [];
    const tagsParam = searchParams.get("tags");
    if (tagsParam) {
      try {
        tagIds = JSON.parse(tagsParam);
      } catch (err) {
        console.error("Invalid tag param:", err);
      }
    }
    const finalTags: ITag[] = [];
    for (const id of tagIds) {
      const tag = await getTagById(id, session.user!.sub);
      if (tag) finalTags.push(tag);
    }
    setTags(finalTags);
  };

  useEffect(() => {
    if (!session.user) {
      return;
    }
    readTags();
    if (input.trim() === "") {
      getTags(session.user!.sub).then((tags) => {
        setTagOptions(tags);
      });
      return;
    }
  }, [session.user]);

  useEffect(() => {
    if (!session.user) {
      return;
    }

    const delayDebounce = setTimeout(() => {
      if (input.trim() === "") {
        getTags(session.user!.sub).then((tags) => {
          setTagOptions(tags);
        });
        return;
      }
      startTransition(() => {
        getTagsByQuery(input, session.user!.sub).then((tags) => {
          setTagOptions(tags);
        });
      });
    }, 300);

    return () => clearTimeout(delayDebounce);
  }, [input]);

  useEffect(() => {
    if (moreFiltersOpen) {
      readTags();
    }
  }, [moreFiltersOpen]);

  useEffect(() => {
    if (!session.user) {
      return;
    }
    const params = new URLSearchParams(searchParams.toString());
    let tagIds: string[] = [];
    const tagsParam = params.get("tags");
    if (tagsParam) {
      try {
        tagIds = JSON.parse(tagsParam);
      } catch (err) {
        console.error("Invalid tag param:", err);
      }
    }
    const getTagsFromId = async () => {
      let ts: ITag[] = [];
      for (const t of tagIds) {
        const result = await getTagById(t, session.user!.sub);
        if (result) ts.push(result);
      }
      setTags(ts);
    };

    getTagsFromId();
  }, [pathname, searchParams.toString(), session.user]);

  const applyFilters = () => {
    const params = new URLSearchParams();

    if (query) params.set("query", query);
    if (attachedQR !== "all") params.set("attachedQR", attachedQR);
    if (tags.length > 0)
      params.set("tags", JSON.stringify(tags.map((t) => t.id)));
    if (dateRange?.from)
      params.set("startDate", format(dateRange.from, "MM-dd-yyyy"));
    if (dateRange?.to)
      params.set("endDate", format(dateRange.to, "MM-dd-yyyy"));

    params.set("page", "1");

    router.push(`?${params.toString()}`);
    setMoreFiltersOpen(false);
    setCalendarOpen(false);
  };

  const clearQuery = () => {
    setQuery("");
    const params = new URLSearchParams();

    if (attachedQR !== "all") params.set("attachedQR", attachedQR);
    if (tags.length > 0)
      params.set("tags", JSON.stringify(tags.map((t) => t.id)));
    if (dateRange?.from)
      params.set("startDate", format(dateRange.from, "MM-dd-yyyy"));
    if (dateRange?.to)
      params.set("endDate", format(dateRange.to, "MM-dd-yyyy"));

    params.set("page", "1");

    router.push(`?${params.toString()}`);
    setMoreFiltersOpen(false);
    setCalendarOpen(false);
  };

  const clearDate = () => {
    setDateRange(undefined);
    const params = new URLSearchParams();

    if (query) params.set("query", query);
    if (attachedQR !== "all") params.set("attachedQR", attachedQR);
    if (tags.length > 0)
      params.set("tags", JSON.stringify(tags.map((t) => t.id)));

    params.set("page", "1");

    router.push(`?${params.toString()}`);
    setMoreFiltersOpen(false);
    setCalendarOpen(false);
  };

  const clearMoreFilters = () => {
    setAttachedQR("all");
    setTags([]);
    const params = new URLSearchParams();

    if (query) params.set("query", query);

    if (dateRange?.from)
      params.set("startDate", format(dateRange.from, "MM-dd-yyyy"));
    if (dateRange?.to)
      params.set("endDate", format(dateRange.to, "MM-dd-yyyy"));

    params.set("page", "1");

    router.push(`?${params.toString()}`);
    setMoreFiltersOpen(false);
    setCalendarOpen(false);
  };

  if (!session.user) {
    return null;
  }

  return (
    <div className="w-full flex md:flex-row flex-col justify-start gap-2 lg:items-center items-start pb-4 border-b-2 relative col-span-full">
      <div className="relative w-full lg:max-w-[375px] md:max-w-[300px]">
        <Input
          type="text"
          name="query"
          id="query"
          placeholder="Search codes"
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
        <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
          <PopoverTrigger asChild>
            <Button
              id="date-picker"
              variant={"outline"}
              className="w-full md:max-w-[200px]! max-w-full"
            >
              <CalendarIcon className="size-3.5" />
              <p className="font-semibold">
                {dateRange?.from && dateRange?.to
                  ? `${format(dateRange.from, "MMM dd")} – ${format(
                      dateRange.to,
                      "MMM dd"
                    )}`
                  : "Filter by created date"}
              </p>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[320px]">
            <div className="p-0 w-full">
              <div className="text-left flex flex-col gap-0">
                <h1 className="font-bold xs:text-base text-sm text-left">
                  Filter by created date
                </h1>
                <p className="text-muted-foreground xs:text-sm text-xs text-left">
                  Display only QR Codes created on the selected range.
                </p>
              </div>
              <Separator className="my-2" />
              <Calendar
                className="w-[225px] mx-auto p-0"
                mode="range"
                selected={dateRange}
                onSelect={setDateRange}
                disabled={(date) => {
                  return date > new Date();
                }}
              />
              <Separator className="my-2" />
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
          </PopoverContent>
        </Popover>
        <Popover open={moreFiltersOpen} onOpenChange={setMoreFiltersOpen}>
          <PopoverTrigger asChild>
            <Button
              id="filters"
              variant={"outline"}
              className="w-full md:max-w-[120px]! max-w-full"
            >
              <Settings2 className="size-3.5" />
              <p className="font-semibold">
                {tags.length === 0 && attachedQR === "all" ? (
                  <>Add Filters</>
                ) : (
                  <>
                    {(() => {
                      let count = tags.length;
                      if (attachedQR !== "all") count++;
                      return `${count} filter${count > 1 ? "s" : ""}`;
                    })()}
                  </>
                )}
              </p>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[320px] overflow-hidden p-0">
            <div className="p-4 w-full flex flex-col gap-4">
              <div className="text-left flex flex-col gap-0">
                <h1 className="font-bold xs:text-base text-sm text-left">
                  Filters
                </h1>
              </div>
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
                      <div className="flex flex-row items-center gap-1 flex-wrap w-full h-full snap-y snap-start overflow-y-scroll">
                        {tags.length > 0
                          ? tags.map((tag) => {
                              return (
                                <p
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setTags((prev) => {
                                      const n = [...prev];
                                      const index = n.indexOf(tag);
                                      n.splice(index, 1);
                                      return n;
                                    });
                                  }}
                                  key={tag.id}
                                  className={cn(
                                    "inline-flex items-center justify-center gap-1 whitespace-nowrap rounded-md text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
                                    "bg-secondary text-secondary-foreground shadow-xs hover:bg-secondary/80 h-full! p-1! text-sm rounded-none! hover:cursor-pointer"
                                  )}
                                >
                                  {tag.tagName}
                                  <X className="w-3! h-3!" />
                                </p>
                              );
                            })
                          : "Select tags..."}
                      </div>

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
                        value={input}
                        onValueChange={setInput}
                      />
                      <CommandList className="items-stretch flex flex-col gap-1 w-full">
                        <CommandEmpty>No options.</CommandEmpty>
                        <CommandGroup className="w-full">
                          {tagOptions.map((tag) => (
                            <CommandItem
                              className="w-full! max-w-full! justify-center gap-1"
                              key={tag.id}
                              value={tag.tagName}
                              onSelect={async (val) => {
                                const added = tags?.some(
                                  (_tag) => _tag.id == tag.id
                                );
                                if (added) {
                                  setTags((prev) => {
                                    const n = [...prev];
                                    const index = n.findIndex((t) => {
                                      t.id == tag.id;
                                    });
                                    n.splice(index, 1);
                                    return n;
                                  });
                                } else {
                                  setTags((prev) => {
                                    const n = [...prev, tag];
                                    return n;
                                  });
                                }
                              }}
                            >
                              {tag.tagName}
                              <Check
                                className={cn(
                                  "ml-auto",
                                  tags?.some((_tag) => _tag.id == tag.id)
                                    ? "opacity-100"
                                    : "opacity-0"
                                )}
                              />
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
              <div className="w-full flex flex-col gap-2">
                <Label className="font-semibold">Attached Link</Label>
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
                        QR Codes
                        <span className="font-semibold -mx-1">
                          with or without
                        </span>
                        attached Links
                      </SelectItem>
                      <SelectItem value="on">
                        QR Codes
                        <span className="font-semibold -mx-1">with</span>
                        attached Links
                      </SelectItem>
                      <SelectItem value="off">
                        QR Codes
                        <span className="font-semibold -mx-1">without</span>
                        attached Links
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
          </PopoverContent>
        </Popover>
        {query && (
          <Button className="md:w-auto w-full" onClick={applyFilters}>
            Search
          </Button>
        )}
      </div>
    </div>
  );
};
