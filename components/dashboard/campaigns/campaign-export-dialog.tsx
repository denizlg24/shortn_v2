"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import {
  Download,
  CalendarIcon,
  X,
  Loader2,
  FileSpreadsheet,
} from "lucide-react";
import { format } from "date-fns";
import { DateRange } from "react-day-picker";
import { exportCampaignData } from "@/app/actions/linkActions";
import { toast } from "sonner";
import { CampaignStats } from "@/app/actions/linkActions";
import { useTranslations } from "next-intl";

interface CampaignExportDialogProps {
  campaignId: string;
  campaignTitle: string;
  stats?: CampaignStats;
  trigger?: React.ReactNode;
}

export function CampaignExportDialog({
  campaignId,
  campaignTitle,
  stats,
  trigger,
}: CampaignExportDialogProps) {
  const t = useTranslations("campaign-export");
  const [open, setOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [selectedSources, setSelectedSources] = useState<string[]>([]);
  const [selectedMediums, setSelectedMediums] = useState<string[]>([]);
  const [selectedTerms, setSelectedTerms] = useState<string[]>([]);
  const [selectedContents, setSelectedContents] = useState<string[]>([]);

  const availableSources = stats?.utmBreakdown.sources || [];
  const availableMediums = stats?.utmBreakdown.mediums || [];
  const availableTerms = stats?.utmBreakdown.terms || [];
  const availableContents = stats?.utmBreakdown.contents || [];

  const hasFilters =
    dateRange?.from ||
    selectedSources.length > 0 ||
    selectedMediums.length > 0 ||
    selectedTerms.length > 0 ||
    selectedContents.length > 0;

  const clearFilters = () => {
    setDateRange(undefined);
    setSelectedSources([]);
    setSelectedMediums([]);
    setSelectedTerms([]);
    setSelectedContents([]);
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const result = await exportCampaignData({
        campaignId,
        filters: {
          startDate: dateRange?.from,
          endDate: dateRange?.to,
          sources: selectedSources.length > 0 ? selectedSources : undefined,
          mediums: selectedMediums.length > 0 ? selectedMediums : undefined,
          terms: selectedTerms.length > 0 ? selectedTerms : undefined,
          contents: selectedContents.length > 0 ? selectedContents : undefined,
        },
      });

      if (result.success && result.url) {
        const link = document.createElement("a");
        link.href = result.url;
        link.download = `${campaignTitle.replace(/[^a-z0-9]/gi, "-")}-export-${format(new Date(), "yyyy-MM-dd")}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success(t("toast.export-success"));
        setOpen(false);
      } else {
        toast.error(result.message || t("toast.export-failed"));
      }
    } catch (error) {
      console.error("Export failed:", error);
      toast.error(t("toast.export-error"));
    } finally {
      setExporting(false);
    }
  };

  const FilterSection = ({
    label,
    items,
    selected,
    onToggle,
  }: {
    label: string;
    items: Array<{ name: string; clicks: number }>;
    selected: string[];
    onToggle: (value: string) => void;
  }) => {
    if (items.length === 0) return null;

    return (
      <div className="space-y-2">
        <Label className="text-sm font-medium">{label}</Label>
        <ScrollArea className="h-[120px] rounded-md border p-2">
          <div className="space-y-2">
            {items.map((item) => (
              <div
                key={item.name}
                className="flex items-center justify-between gap-2"
              >
                <div className="flex items-center gap-2">
                  <Checkbox
                    id={`${label}-${item.name}`}
                    checked={selected.includes(item.name)}
                    onCheckedChange={() => onToggle(item.name)}
                  />
                  <label
                    htmlFor={`${label}-${item.name}`}
                    className="text-sm cursor-pointer truncate max-w-[150px]"
                  >
                    {item.name}
                  </label>
                </div>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {item.clicks.toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>
    );
  };

  const toggleSelection = (
    value: string,
    selected: string[],
    setSelected: (values: string[]) => void,
  ) => {
    if (selected.includes(value)) {
      setSelected(selected.filter((v) => v !== value));
    } else {
      setSelected([...selected, value]);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline">
            <Download className="w-4 h-4 mr-2" />
            {t("export")}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5" />
            {t("title")}
          </DialogTitle>
          <DialogDescription>
            {t("description", { campaign: campaignTitle })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="space-y-2">
            <Label className="text-sm font-medium">{t("date-range")}</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !dateRange && "text-muted-foreground",
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dateRange?.from ? (
                    dateRange.to ? (
                      <>
                        {format(dateRange.from, "LLL dd, y")} -{" "}
                        {format(dateRange.to, "LLL dd, y")}
                      </>
                    ) : (
                      format(dateRange.from, "LLL dd, y")
                    )
                  ) : (
                    t("all-time")
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 z-99" align="start">
                <Calendar
                  initialFocus
                  mode="range"
                  defaultMonth={dateRange?.from}
                  selected={dateRange}
                  onSelect={setDateRange}
                  numberOfMonths={2}
                  disabled={(date) => date > new Date()}
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <FilterSection
              label={t("sources")}
              items={availableSources}
              selected={selectedSources}
              onToggle={(v) =>
                toggleSelection(v, selectedSources, setSelectedSources)
              }
            />
            <FilterSection
              label={t("mediums")}
              items={availableMediums}
              selected={selectedMediums}
              onToggle={(v) =>
                toggleSelection(v, selectedMediums, setSelectedMediums)
              }
            />
            <FilterSection
              label={t("terms")}
              items={availableTerms}
              selected={selectedTerms}
              onToggle={(v) =>
                toggleSelection(v, selectedTerms, setSelectedTerms)
              }
            />
            <FilterSection
              label={t("contents")}
              items={availableContents}
              selected={selectedContents}
              onToggle={(v) =>
                toggleSelection(v, selectedContents, setSelectedContents)
              }
            />
          </div>

          {hasFilters && (
            <div className="flex items-center justify-between pt-2 border-t">
              <div className="flex flex-wrap gap-1.5">
                {dateRange?.from && (
                  <Badge variant="secondary" className="text-xs">
                    {format(dateRange.from, "MMM d")}
                    {dateRange.to && ` - ${format(dateRange.to, "MMM d")}`}
                  </Badge>
                )}
                {selectedSources.map((s) => (
                  <Badge key={s} variant="secondary" className="text-xs">
                    {s}
                  </Badge>
                ))}
                {selectedMediums.map((m) => (
                  <Badge key={m} variant="secondary" className="text-xs">
                    {m}
                  </Badge>
                ))}
                {selectedTerms.map((t) => (
                  <Badge key={t} variant="secondary" className="text-xs">
                    {t}
                  </Badge>
                ))}
                {selectedContents.map((c) => (
                  <Badge key={c} variant="secondary" className="text-xs">
                    {c}
                  </Badge>
                ))}
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                className="shrink-0"
              >
                <X className="w-3.5 h-3.5 mr-1" />
                {t("clear")}
              </Button>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t">
          <Button variant="outline" onClick={() => setOpen(false)}>
            {t("cancel")}
          </Button>
          <Button onClick={handleExport} disabled={exporting}>
            {exporting ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Download className="w-4 h-4 mr-2" />
            )}
            {t("export-csv")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
