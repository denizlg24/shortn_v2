"use client";

import { useState } from "react";
import { updateUTM } from "@/app/actions/linkActions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Link } from "@/i18n/navigation";
import { getShortUrl } from "@/lib/utils";
import {
  CheckCircle,
  Copy,
  ExternalLink,
  HelpCircle,
  Loader2,
  Pencil,
  Plus,
  Share2,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { IUtmDefaults } from "@/models/url/Campaigns";
import { useTranslations } from "next-intl";

interface UtmLink {
  source?: string;
  medium?: string;
  campaign?: {
    _id: unknown;
    title: string;
  };
  term?: string;
  content?: string;
}

interface CampaignLinkUtmEditorProps {
  urlCode: string;
  linkTitle: string;
  longUrl: string;
  campaignId: string;
  campaignTitle: string;
  utmDefaults?: IUtmDefaults;
  initialUtmLinks: UtmLink[];
  onSave?: () => void;
}

function buildUrl(shortUrl: string, utm?: UtmLink): string {
  if (!utm) return shortUrl;

  const params = new URLSearchParams();

  if (utm.source) params.set("utm_source", utm.source);
  if (utm.medium) params.set("utm_medium", utm.medium);
  if (utm.campaign?.title) params.set("utm_campaign", utm.campaign.title);
  if (utm.term) params.set("utm_term", utm.term);
  if (utm.content) params.set("utm_content", utm.content);

  if ([...params].length === 0) return shortUrl;

  const separator = shortUrl.includes("?") ? "&" : "?";
  return `${shortUrl}${separator}${params.toString()}`;
}

export function CampaignLinkUtmEditor({
  urlCode,
  linkTitle,
  longUrl,
  campaignId,
  campaignTitle,
  utmDefaults,
  initialUtmLinks,
  onSave,
}: CampaignLinkUtmEditorProps) {
  const t = useTranslations("utm-editor");
  const shortUrl = getShortUrl(urlCode);

  const campaignUtmLinks = initialUtmLinks.filter(
    (utm) => utm.campaign?.title === campaignTitle,
  );

  const defaultUtmLinks =
    campaignUtmLinks.length > 0
      ? campaignUtmLinks
      : [{ campaign: { _id: campaignId, title: campaignTitle } }];

  const [utmLinks, setUtmLinks] = useState<UtmLink[]>(defaultUtmLinks);
  const [savedBaseline, setSavedBaseline] =
    useState<UtmLink[]>(defaultUtmLinks);
  const [saving, setSaving] = useState(false);
  const [justCopied, setJustCopied] = useState<number | null>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  const hasChanges = (() => {
    if (utmLinks.length !== savedBaseline.length) return true;

    return utmLinks.some((utm, i) => {
      const orig = savedBaseline[i];
      if (!orig) return true;
      return (
        utm.source !== orig.source ||
        utm.medium !== orig.medium ||
        utm.term !== orig.term ||
        utm.content !== orig.content
      );
    });
  })();

  const handleCopy = async (index: number, url: string) => {
    await navigator.clipboard.writeText(url);
    setJustCopied(index);
    setTimeout(() => setJustCopied(null), 1500);
    toast.success(t("toast.copied"));
  };

  const getUtmLabel = (utm: UtmLink, index: number): string => {
    const parts: string[] = [];
    if (utm.source) parts.push(utm.source);
    if (utm.medium) parts.push(utm.medium);
    if (utm.term) parts.push(utm.term);
    if (utm.content) parts.push(utm.content);
    return parts.length > 0
      ? parts.join(" / ")
      : t("variant-number", { number: index + 1 });
  };

  const hasUtmParams = (utm: UtmLink): boolean => {
    return !!(utm.source || utm.medium || utm.term || utm.content);
  };

  const updateUtmField = (
    index: number,
    field: keyof Omit<UtmLink, "campaign">,
    value: string,
  ) => {
    setUtmLinks((prev) =>
      prev.map((utm, i) => (i === index ? { ...utm, [field]: value } : utm)),
    );
  };

  const applyDefault = (
    index: number,
    field: keyof Omit<UtmLink, "campaign">,
    value: string,
  ) => {
    updateUtmField(index, field, value);
  };

  const addUtmVariant = () => {
    setUtmLinks((prev) => [
      ...prev,
      { campaign: { _id: campaignId, title: campaignTitle } },
    ]);
  };

  const removeUtmVariant = (index: number) => {
    if (utmLinks.length <= 1) {
      toast.error(t("toast.need-one-utm"));
      return;
    }
    setUtmLinks((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    const isValid = utmLinks.every(
      (utm) =>
        utm.source?.trim() ||
        utm.medium?.trim() ||
        utm.term?.trim() ||
        utm.content?.trim(),
    );

    if (!isValid) {
      toast.error(t("toast.fill-one-param"));
      return;
    }

    setSaving(true);
    try {
      const otherUtmLinks = initialUtmLinks.filter(
        (utm) => utm.campaign?.title !== campaignTitle,
      );
      const allUtmLinks = [...otherUtmLinks, ...utmLinks];

      const result = await updateUTM({
        urlCode,
        utm: allUtmLinks.map((utm) => ({
          source: utm.source,
          medium: utm.medium,
          campaign: utm.campaign?.title
            ? { title: utm.campaign.title }
            : undefined,
          term: utm.term,
          content: utm.content,
        })),
      });

      if (result.success) {
        toast.success(t("toast.saved"));
        setSavedBaseline([...utmLinks]);
        setEditingIndex(null);
        onSave?.();
      } else {
        toast.error(t("toast.save-failed"));
      }
    } catch (error) {
      console.error("Error saving UTM:", error);
      toast.error(t("toast.error"));
    } finally {
      setSaving(false);
    }
  };

  const hasDefaults =
    utmDefaults &&
    ((utmDefaults.sources?.length ?? 0) > 0 ||
      (utmDefaults.mediums?.length ?? 0) > 0 ||
      (utmDefaults.terms?.length ?? 0) > 0 ||
      (utmDefaults.contents?.length ?? 0) > 0);

  const renderUtmForm = (index: number) => {
    const utm = utmLinks[index];
    if (!utm) return null;

    return (
      <div className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label
              htmlFor={`source-${index}`}
              className="flex items-center gap-1.5"
            >
              {t("form.source")}
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <HelpCircle className="w-3.5 h-3.5 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="max-w-xs text-xs">
                      {t("form.source-tooltip")}
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </Label>
            {(utmDefaults?.sources?.length ?? 0) > 0 && (
              <Select onValueChange={(v) => applyDefault(index, "source", v)}>
                <SelectTrigger className="w-[140px] h-7 text-xs">
                  <SelectValue placeholder={t("form.apply-default")} />
                </SelectTrigger>
                <SelectContent>
                  {utmDefaults?.sources?.map((s) => (
                    <SelectItem key={s} value={s} className="text-xs">
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          <Input
            id={`source-${index}`}
            value={utm.source || ""}
            onChange={(e) =>
              updateUtmField(
                index,
                "source",
                e.target.value.toLowerCase().replace(/[^a-z0-9-_]/g, ""),
              )
            }
            placeholder={t("form.source-placeholder")}
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label
              htmlFor={`medium-${index}`}
              className="flex items-center gap-1.5"
            >
              {t("form.medium")}
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <HelpCircle className="w-3.5 h-3.5 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="max-w-xs text-xs">
                      {t("form.medium-tooltip")}
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </Label>
            {(utmDefaults?.mediums?.length ?? 0) > 0 && (
              <Select onValueChange={(v) => applyDefault(index, "medium", v)}>
                <SelectTrigger className="w-[140px] h-7 text-xs">
                  <SelectValue placeholder={t("form.apply-default")} />
                </SelectTrigger>
                <SelectContent>
                  {utmDefaults?.mediums?.map((m) => (
                    <SelectItem key={m} value={m} className="text-xs">
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          <Input
            id={`medium-${index}`}
            value={utm.medium || ""}
            onChange={(e) =>
              updateUtmField(
                index,
                "medium",
                e.target.value.toLowerCase().replace(/[^a-z0-9-_]/g, ""),
              )
            }
            placeholder={t("form.medium-placeholder")}
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label
              htmlFor={`term-${index}`}
              className="flex items-center gap-1.5"
            >
              {t("form.term")}
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <HelpCircle className="w-3.5 h-3.5 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="max-w-xs text-xs">{t("form.term-tooltip")}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </Label>
            {(utmDefaults?.terms?.length ?? 0) > 0 && (
              <Select onValueChange={(v) => applyDefault(index, "term", v)}>
                <SelectTrigger className="w-[140px] h-7 text-xs">
                  <SelectValue placeholder={t("form.apply-default")} />
                </SelectTrigger>
                <SelectContent>
                  {utmDefaults?.terms?.map((t) => (
                    <SelectItem key={t} value={t} className="text-xs">
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          <Input
            id={`term-${index}`}
            value={utm.term || ""}
            onChange={(e) =>
              updateUtmField(
                index,
                "term",
                e.target.value.toLowerCase().replace(/[^a-z0-9-_]/g, ""),
              )
            }
            placeholder={t("form.term-placeholder")}
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label
              htmlFor={`content-${index}`}
              className="flex items-center gap-1.5"
            >
              {t("form.content")}
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <HelpCircle className="w-3.5 h-3.5 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="max-w-xs text-xs">
                      {t("form.content-tooltip")}
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </Label>
            {(utmDefaults?.contents?.length ?? 0) > 0 && (
              <Select onValueChange={(v) => applyDefault(index, "content", v)}>
                <SelectTrigger className="w-[140px] h-7 text-xs">
                  <SelectValue placeholder={t("form.apply-default")} />
                </SelectTrigger>
                <SelectContent>
                  {utmDefaults?.contents?.map((c) => (
                    <SelectItem key={c} value={c} className="text-xs">
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          <Input
            id={`content-${index}`}
            value={utm.content || ""}
            onChange={(e) =>
              updateUtmField(
                index,
                "content",
                e.target.value.toLowerCase().replace(/[^a-z0-9-_]/g, ""),
              )
            }
            placeholder={t("form.content-placeholder")}
          />
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <Card className="p-4 sm:p-6">
        <div className="w-full flex flex-row items-start justify-between gap-2">
          <div className="flex flex-col gap-1 w-full truncate">
            <h2 className="font-bold text-lg truncate">
              {linkTitle || urlCode}
            </h2>
            <div className="w-full flex flex-row justify-start">
              <span className="text-sm text-muted-foreground truncate">
                {longUrl}
              </span>
            </div>
          </div>
          <Button variant="outline" size="sm" asChild className="shrink-0">
            <Link href={`/dashboard/links/${urlCode}/details`}>
              <ExternalLink className="w-3.5 h-3.5 sm:mr-1.5" />
              <span className="hidden sm:inline">{t("view-link")}</span>
            </Link>
          </Button>
        </div>
      </Card>

      <Card className="gap-2">
        <CardHeader className="px-6 py-0">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <Share2 className="w-5 h-5" />
                {t("share-links")}
              </CardTitle>
              <CardDescription>{t("share-links-description")}</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={addUtmVariant}>
              <Plus className="w-4 h-4 mr-1.5" />
              {t("add-variant")}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="px-6">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-[200px]">
                  {t("table.variant")}
                </TableHead>
                <TableHead>{t("table.url")}</TableHead>
                <TableHead className="w-[140px] text-right">
                  {t("table.actions")}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {utmLinks.map((utm, index) => {
                const builtUrl = buildUrl(shortUrl, utm);
                const label = getUtmLabel(utm, index);
                const hasParams = hasUtmParams(utm);

                return (
                  <TableRow key={index} className="group">
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <span className="truncate max-w-40">{label}</span>
                        {!hasParams && (
                          <Badge
                            variant="outline"
                            className="text-[10px] text-amber-600 border-amber-300"
                          >
                            {t("empty")}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <code className="text-xs bg-muted px-2 py-1 rounded truncate max-w-[400px] font-mono">
                          {builtUrl.replace("https://", "").replace("www.", "")}
                        </code>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => handleCopy(index, builtUrl)}
                              >
                                {justCopied === index ? (
                                  <CheckCircle className="w-4 h-4 text-green-500" />
                                ) : (
                                  <Copy className="w-4 h-4" />
                                )}
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>{t("copy-link")}</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() =>
                                  setEditingIndex(
                                    editingIndex === index ? null : index,
                                  )
                                }
                              >
                                <Pencil
                                  className={`w-4 h-4 ${editingIndex === index ? "text-primary" : ""}`}
                                />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              {t("edit-parameters")}
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                        {utmLinks.length > 1 && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-destructive hover:text-destructive"
                                  onClick={() => removeUtmVariant(index)}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                {t("delete-variant")}
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {editingIndex !== null && (
        <Card>
          <CardHeader className="px-6 py-0">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm flex items-center gap-2">
                  <Pencil className="w-4 h-4" />
                  {t("edit-label", {
                    label: getUtmLabel(utmLinks[editingIndex], editingIndex),
                  })}
                </CardTitle>
                <CardDescription>{t("modify-utm-params")}</CardDescription>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setEditingIndex(null)}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="px-6 py-0">
            {hasDefaults && (
              <div className="mb-4 p-3 bg-muted/50 rounded-lg">
                <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-primary" />
                  {t("campaign-defaults")}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {utmDefaults?.sources?.map((s) => (
                    <Badge
                      key={`source-${s}`}
                      variant="secondary"
                      className="text-xs cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors"
                      onClick={() => applyDefault(editingIndex, "source", s)}
                    >
                      {s}
                    </Badge>
                  ))}
                  {utmDefaults?.mediums?.map((m) => (
                    <Badge
                      key={`medium-${m}`}
                      variant="outline"
                      className="text-xs cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors"
                      onClick={() => applyDefault(editingIndex, "medium", m)}
                    >
                      {m}
                    </Badge>
                  ))}
                  {utmDefaults?.terms?.map((t) => (
                    <Badge
                      key={`term-${t}`}
                      variant="secondary"
                      className="text-xs cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors"
                      onClick={() => applyDefault(editingIndex, "term", t)}
                    >
                      {t}
                    </Badge>
                  ))}
                  {utmDefaults?.contents?.map((c) => (
                    <Badge
                      key={`content-${c}`}
                      variant="outline"
                      className="text-xs cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors"
                      onClick={() => applyDefault(editingIndex, "content", c)}
                    >
                      {c}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            {renderUtmForm(editingIndex)}
          </CardContent>
        </Card>
      )}

      <div className="flex justify-end gap-3">
        <Button variant="outline" asChild>
          <Link href={`/dashboard/campaigns/${campaignId}`}>
            {hasChanges ? t("cancel") : t("back-to-campaign")}
          </Link>
        </Button>
        {hasChanges && (
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                {t("saving")}
              </>
            ) : (
              t("save-changes")
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
