"use client";
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
import { ScrollPopoverContent } from "@/components/ui/scroll-popover-content";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useIsMobile } from "@/hooks/use-mobile";
import { usePathname, useRouter } from "@/i18n/navigation";
import { cn, fetchApi } from "@/lib/utils";
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
import { useEffect, useState } from "react";
import { DateRange } from "react-day-picker";

export const LinkFilterBar = () => {
  const [open, setOpen] = useState(false);
  const [moreFiltersOpen, setMoreFiltersOpen] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [calendarStartOpen, setCalendarStartOpen] = useState(false);
  const [calendarEndOpen, setCalendarEndOpen] = useState(false);
  const [input, setInput] = useState("");
  const [tagOptions, setTagOptions] = useState<ITag[]>([]);

  const session = useUser();
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

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
      const tag = await fetchApi<{ tag: ITag }>(`tags/${id}`);
      if (tag.success) finalTags.push(tag.tag);
    }
    setTags(finalTags);
  };

  useEffect(() => {
    if (!session.user) {
      return;
    }
    readTags();
    if (input.trim() === "") {
      fetchApi<{ tags: ITag[] }>("tags").then((res) => {
        if (res.success) {
          setTagOptions(res.tags);
        } else {
          setTagOptions([]);
        }
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
        fetchApi<{ tags: ITag[] }>("tags").then((res) => {
          if (res.success) {
            setTagOptions(res.tags);
          } else {
            setTagOptions([]);
          }
        });
        return;
      }
      fetchApi<{ tags: ITag[] }>(`tags?q=${input}`).then((res) => {
        if (res.success) {
          setTagOptions(res.tags);
        } else {
          setTagOptions([]);
        }
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
        const tag = await fetchApi<{ tag: ITag }>(`tags/${t}`);
        if (tag.success) ts.push(tag.tag);
      }
      setTags(ts);
    };

    getTagsFromId();
  }, [pathname, searchParams.toString(), session.user]);

  const applyFilters = ({
    override_query,
    override_customLink,
    override_attachedQR,
    override_tags,
    override_start,
    override_end,
    override_page,
  }: {
    override_query?: string;
    override_customLink?: string;
    override_attachedQR?: string;
    override_tags?: ITag[];
    override_start?: Date;
    override_end?: Date;
    override_page?: number;
  }) => {
    const params = new URLSearchParams();

    if (query) params.set("query", query);
    if (override_query) params.set("query", override_query);

    if (customLink !== "all") params.set("customLink", customLink);
    if (override_customLink && override_customLink !== "all")
      params.set("customLink", override_customLink);

    if (attachedQR !== "all") params.set("attachedQR", attachedQR);
    if (override_attachedQR && override_attachedQR !== "all")
      params.set("attachedQR", override_attachedQR);

    if (tags.length > 0)
      params.set("tags", JSON.stringify(tags.map((t) => t.id)));
    if (override_tags && override_tags.length > 0)
      params.set("tags", JSON.stringify(override_tags.map((t) => t.id)));

    if (dateRange?.from)
      params.set("startDate", format(dateRange.from, "MM-dd-yyyy"));
    if (override_start)
      params.set("startDate", format(override_start, "MM-dd-yyyy"));

    if (dateRange?.to)
      params.set("endDate", format(dateRange.to, "MM-dd-yyyy"));
    if (override_end) params.set("endDate", format(override_end, "MM-dd-yyyy"));

    params.set("page", "1");
    if (override_page) params.set("page", override_page.toString());

    router.push(`?${params.toString()}`);
  };

  const clearQuery = () => {
    setQuery("");
    const params = new URLSearchParams();

    if (customLink !== "all") params.set("customLink", customLink);
    if (attachedQR !== "all") params.set("attachedQR", attachedQR);
    if (tags.length > 0)
      params.set("tags", JSON.stringify(tags.map((t) => t.id)));
    if (dateRange?.from)
      params.set("startDate", format(dateRange.from, "MM-dd-yyyy"));
    if (dateRange?.to)
      params.set("endDate", format(dateRange.to, "MM-dd-yyyy"));
    params.set("page", "1");

    router.push(`?${params.toString()}`);
  };

  const clearMoreFilters = () => {
    setCustomLink("all");
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
  };

  const isMobile = useIsMobile();

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
        {!isMobile ? (
          <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
            <PopoverTrigger asChild>
              <Button id="date-picker" variant={"outline"} className="w-fit">
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
            <ScrollPopoverContent className="w-auto">
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
                  className="mx-auto p-0"
                  mode="range"
                  numberOfMonths={2}
                  showOutsideDays={false}
                  fixedWeeks
                  selected={dateRange}
                  onSelect={(range) => {
                    if (range?.from && range?.to && range.to != range.from) {
                      setDateRange(range);
                      applyFilters({
                        override_start: range.from,
                        override_end: range.to,
                      });
                      setCalendarOpen(false);
                    } else {
                      if (range?.from) {
                        setDateRange((prev) => {
                          return { ...prev, from: range.from };
                        });
                      } else if (range?.to) {
                        setDateRange((prev) => {
                          return { from: prev?.from, to: range.from };
                        });
                        setCalendarOpen(false);
                        applyFilters({
                          override_start: range.from,
                          override_end: range.to,
                        });
                      }
                    }
                  }}
                  disabled={(date) => {
                    return date > new Date();
                  }}
                />
                <Separator className="my-2" />
                <div className="flex flex-row w-full items-center gap-2 justify-end">
                  <Button
                    onClick={(e) => {
                      e.stopPropagation();
                      setDateRange(undefined);
                      const params = new URLSearchParams();

                      if (query) params.set("query", query);
                      if (customLink !== "all")
                        params.set("customLink", customLink);
                      if (attachedQR !== "all")
                        params.set("attachedQR", attachedQR);
                      if (tags.length > 0)
                        params.set(
                          "tags",
                          JSON.stringify(tags.map((t) => t.id))
                        );

                      params.set("page", "1");
                      setCalendarOpen(false);
                      router.push(`?${params.toString()}`);
                    }}
                    variant={"ghost"}
                  >
                    <X />
                    Clear Filters
                  </Button>
                  <Button
                    onClick={() => {
                      setCalendarOpen(false);
                      applyFilters({});
                    }}
                    variant={"default"}
                  >
                    Apply
                  </Button>
                </div>
              </div>
            </ScrollPopoverContent>
          </Popover>
        ) : (
          <div className="flex flex-row items-center w-full gap-2">
            <Dialog
              open={calendarStartOpen}
              onOpenChange={setCalendarStartOpen}
            >
              <DialogTrigger asChild>
                <Button
                  id="date-picker"
                  variant={"outline"}
                  className="grow flex-1"
                >
                  <CalendarIcon className="size-3.5" />
                  <p className="font-semibold">
                    {dateRange?.from
                      ? `${format(dateRange.from, "dd/MM/yyyy")}`
                      : "Filter by created date"}
                  </p>
                </Button>
              </DialogTrigger>
              <DialogContent className="w-[320px]">
                <DialogHeader>
                  <DialogTitle>Filter by created date</DialogTitle>
                  <DialogDescription>
                    Display only short links created on the selected range.
                  </DialogDescription>
                </DialogHeader>
                <div className="p-0 w-full">
                  <Separator className="my-2" />
                  <Calendar
                    className="mx-auto p-0"
                    mode="single"
                    showOutsideDays={false}
                    selected={dateRange?.from}
                    onSelect={(date) => {
                      if (!date) {
                        setDateRange(undefined);
                      } else {
                        setDateRange((prev) => ({
                          ...prev,
                          from: date,
                        }));
                      }
                      setCalendarStartOpen(false);
                      applyFilters({ override_start: date });
                    }}
                    disabled={(date) => {
                      return date > new Date();
                    }}
                  />
                  <Separator className="my-2" />
                  <div className="flex flex-row w-full items-center gap-2 justify-end">
                    <Button
                      onClick={(e) => {
                        e.stopPropagation();
                        setDateRange(undefined);
                        const params = new URLSearchParams();

                        if (query) params.set("query", query);
                        if (customLink !== "all")
                          params.set("customLink", customLink);
                        if (attachedQR !== "all")
                          params.set("attachedQR", attachedQR);
                        if (tags.length > 0)
                          params.set(
                            "tags",
                            JSON.stringify(tags.map((t) => t.id))
                          );

                        params.set("page", "1");
                        setCalendarStartOpen(false);
                        router.push(`?${params.toString()}`);
                      }}
                      variant={"ghost"}
                    >
                      <X />
                      Clear Filters
                    </Button>
                    <Button
                      onClick={() => {
                        setCalendarStartOpen(false);
                        applyFilters({});
                      }}
                      variant={"default"}
                    >
                      Apply
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
            {dateRange?.from && (
              <>
                <p>-</p>
                <Dialog
                  open={calendarEndOpen}
                  onOpenChange={setCalendarEndOpen}
                >
                  <DialogTrigger asChild>
                    <Button
                      id="date-picker"
                      variant={"outline"}
                      className="grow flex-1"
                    >
                      <CalendarIcon className="size-3.5" />
                      <p className="font-semibold">
                        {dateRange?.to
                          ? `${format(dateRange.to, "dd/MM/yyyy")}`
                          : "End"}
                      </p>
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="w-[320px]">
                    <DialogHeader>
                      <DialogTitle>Filter by created date</DialogTitle>
                      <DialogDescription>
                        Display only short links created on the selected range.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="p-0 w-full">
                      <Separator className="my-2" />
                      <Calendar
                        className="mx-auto p-0"
                        mode="single"
                        showOutsideDays={false}
                        selected={dateRange?.to}
                        onSelect={(date) => {
                          setDateRange((prev) => {
                            if (!prev) {
                              return prev;
                            }
                            return { ...prev, to: date };
                          });
                          setCalendarEndOpen(false);
                          applyFilters({ override_end: date });
                        }}
                        disabled={(date) => {
                          return date > new Date();
                        }}
                      />
                      <Separator className="my-2" />
                      <div className="flex flex-row w-full items-center gap-2 justify-end">
                        <Button
                          onClick={(e) => {
                            e.stopPropagation();
                            setDateRange(undefined);
                            const params = new URLSearchParams();

                            if (query) params.set("query", query);
                            if (customLink !== "all")
                              params.set("customLink", customLink);
                            if (attachedQR !== "all")
                              params.set("attachedQR", attachedQR);
                            if (tags.length > 0)
                              params.set(
                                "tags",
                                JSON.stringify(tags.map((t) => t.id))
                              );

                            params.set("page", "1");
                            setCalendarEndOpen(false);
                            router.push(`?${params.toString()}`);
                          }}
                          variant={"ghost"}
                        >
                          <X />
                          Clear Filters
                        </Button>
                        <Button
                          onClick={() => {
                            setCalendarEndOpen(false);
                            applyFilters({});
                          }}
                          variant={"default"}
                        >
                          Apply
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </>
            )}
          </div>
        )}
        {isMobile ? (
          <Dialog open={moreFiltersOpen} onOpenChange={setMoreFiltersOpen}>
            <DialogTrigger asChild>
              <Button
                id="filters"
                variant={"outline"}
                className="w-full md:max-w-[120px]! max-w-full"
              >
                <Settings2 className="size-3.5" />
                <p className="font-semibold">
                  {tags.length === 0 &&
                  customLink === "all" &&
                  attachedQR === "all" ? (
                    <>Add Filters</>
                  ) : (
                    <>
                      {(() => {
                        let count = tags.length;
                        if (customLink !== "all") count++;
                        if (attachedQR !== "all") count++;
                        return `${count} filter${count > 1 ? "s" : ""}`;
                      })()}
                    </>
                  )}
                </p>
              </Button>
            </DialogTrigger>
            <DialogContent className="w-full min-w-[250px] overflow-hidden p-0 pt-6">
              <DialogHeader className="px-4 text-left">
                <DialogTitle>Filters</DialogTitle>
                <DialogDescription>
                  Apply filters to better find your short links.
                </DialogDescription>
              </DialogHeader>
              <div className="p-4 pt-0 w-full flex flex-col gap-4">
                <div className="w-full flex flex-col gap-2">
                  <Label className="font-semibold">Tags</Label>
                  <Dialog open={open} onOpenChange={setOpen}>
                    <DialogTrigger asChild>
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
                    </DialogTrigger>
                    <DialogContent className="w-full min-w-[250px] p-0 pt-6">
                      <DialogHeader className="px-4 text-left">
                        <DialogTitle>Edit tags</DialogTitle>
                        <DialogDescription>
                          Add or remove tags to make it easier to find your
                          link.
                        </DialogDescription>
                      </DialogHeader>
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
                    </DialogContent>
                  </Dialog>
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
                    <SelectContent className="z-99">
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
                    <SelectContent className="z-99">
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
                  <Button
                    onClick={() => {
                      setMoreFiltersOpen(false);
                      clearMoreFilters();
                    }}
                    variant={"ghost"}
                  >
                    <X />
                    Clear Filters
                  </Button>
                  <Button
                    onClick={() => {
                      setMoreFiltersOpen(false);
                      applyFilters({});
                    }}
                    variant={"default"}
                  >
                    Apply
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        ) : (
          <Popover open={moreFiltersOpen} onOpenChange={setMoreFiltersOpen}>
            <PopoverTrigger asChild>
              <Button id="filters" variant={"outline"} className="w-fit">
                <Settings2 className="size-3.5" />
                <p className="font-semibold">
                  {tags.length === 0 &&
                  customLink === "all" &&
                  attachedQR === "all" ? (
                    <>Add Filters</>
                  ) : (
                    <>
                      {(() => {
                        let count = tags.length;
                        if (customLink !== "all") count++;
                        if (attachedQR !== "all") count++;
                        return `${count} filter${count > 1 ? "s" : ""}`;
                      })()}
                    </>
                  )}
                </p>
              </Button>
            </PopoverTrigger>
            <ScrollPopoverContent className="w-[320px] overflow-hidden p-0">
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
                    <ScrollPopoverContent
                      align="start"
                      side="bottom"
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
                    </ScrollPopoverContent>
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
                  <Button
                    onClick={() => {
                      setMoreFiltersOpen(false);
                      clearMoreFilters();
                    }}
                    variant={"ghost"}
                  >
                    <X />
                    Clear Filters
                  </Button>
                  <Button
                    onClick={() => {
                      setMoreFiltersOpen(false);
                      applyFilters({});
                    }}
                    variant={"default"}
                  >
                    Apply
                  </Button>
                </div>
              </div>
            </ScrollPopoverContent>
          </Popover>
        )}

        {query && (
          <Button
            className="md:w-auto w-full"
            onClick={() => {
              applyFilters({});
            }}
          >
            Search
          </Button>
        )}
      </div>
    </div>
  );
};
