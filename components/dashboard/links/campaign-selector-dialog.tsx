"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormRootError,
} from "@/components/ui/form";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "sonner";
import { useState, useEffect, ReactNode } from "react";
import { createCampaign, getUserCampaigns } from "@/app/actions/linkActions";
import { Plus, Check, ChevronDown, ExternalLink, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { Link } from "@/i18n/navigation";
import { IUtmDefaults } from "@/models/url/Campaigns";
import { useTranslations } from "next-intl";

type Campaign = {
  _id: string;
  title: string;
  linksCount: number;
  description?: string;
  utmDefaults?: IUtmDefaults;
};

const getUtmDefaultsCount = (utmDefaults?: IUtmDefaults): number => {
  if (!utmDefaults) return 0;
  return (
    (utmDefaults.sources?.length || 0) +
    (utmDefaults.mediums?.length || 0) +
    (utmDefaults.terms?.length || 0) +
    (utmDefaults.contents?.length || 0)
  );
};

export const CampaignSelectorDialog = ({
  selectedCampaign,
  onSelect,
  trigger,
}: {
  selectedCampaign?: { _id: unknown; title: string };
  onSelect: (campaign: { _id: string; title: string } | undefined) => void;
  trigger?: ReactNode;
}) => {
  const t = useTranslations("campaign-selector");
  const [open, setOpen] = useState(false);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);

  const campaignFormSchema = z.object({
    title: z
      .string()
      .min(1, t("errors.name-required"))
      .max(100, t("errors.name-too-long"))
      .regex(/^[A-Za-z0-9 _-]+$/, t("errors.name-invalid-chars")),
  });

  const campaignForm = useForm<z.infer<typeof campaignFormSchema>>({
    resolver: zodResolver(campaignFormSchema),
    defaultValues: {
      title: "",
    },
  });

  useEffect(() => {
    const loadCampaigns = async () => {
      setLoading(true);
      const result = await getUserCampaigns();
      if (result.success) {
        setCampaigns(result.campaigns as Campaign[]);
      }
      setLoading(false);
    };
    if (open) {
      loadCampaigns();
      campaignForm.reset();
    }
  }, [open, campaignForm]);

  const handleCreateNew = async () => {
    setCreating(true);

    const valid = await campaignForm.trigger();
    if (!valid) {
      setCreating(false);
      return;
    }

    const data = campaignForm.getValues();
    const result = await createCampaign({
      title: data.title,
    });

    if (result.success && result.campaign) {
      toast.success(t("toast.created"));
      onSelect({
        _id: result.campaign._id,
        title: result.campaign.title,
      });
      setOpen(false);
      campaignForm.reset();
    } else {
      switch (result.message) {
        case "duplicate":
          campaignForm.setError("title", {
            message: t("errors.duplicate"),
          });
          break;
        case "plan-restricted":
          campaignForm.setError("root", {
            message: t("errors.plan-restricted"),
          });
          break;
        case "no-user":
          campaignForm.setError("root", {
            message: t("errors.no-user"),
          });
          break;
        case "server-error":
          campaignForm.setError("root", {
            message: t("errors.server-error"),
          });
          break;
        default:
          campaignForm.setError("root", {
            message: t("errors.create-failed"),
          });
      }
    }
    setCreating(false);
  };

  const handleSelectExisting = (campaign: Campaign) => {
    if (selectedCampaign?.title === campaign.title) {
      onSelect(undefined);
    } else {
      onSelect({
        _id: campaign._id,
        title: campaign.title,
      });
    }
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <div className="w-full relative cursor-pointer">
            <Input
              readOnly
              value={selectedCampaign?.title || t("placeholder")}
              className="text-left pl-6 cursor-pointer"
            />
            <ChevronDown className="w-4 h-4 left-1.5 top-1/2 -translate-y-1/2 absolute" />
          </div>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>
        <Tabs defaultValue="select" className="w-full">
          <TabsList className="w-full">
            <TabsTrigger value="select">{t("tabs.select")}</TabsTrigger>
            <TabsTrigger value="create">{t("tabs.create")}</TabsTrigger>
          </TabsList>
          <Separator className="mt-1" />
          <TabsContent value="select">
            <div className="flex flex-col gap-3">
              <h3 className="text-sm font-semibold">{t("your-campaigns")}</h3>
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Spinner className="h-6 w-6" />
                </div>
              ) : campaigns.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  {t("no-campaigns")}
                </p>
              ) : (
                <ScrollArea className="h-60 rounded-md border bg-muted p-2">
                  <div className="flex flex-col gap-2">
                    {campaigns.map((campaign) => {
                      const isSelected =
                        selectedCampaign?.title === campaign.title;
                      const defaultsCount = getUtmDefaultsCount(
                        campaign.utmDefaults,
                      );
                      return (
                        <HoverCard
                          key={campaign._id}
                          openDelay={200}
                          closeDelay={100}
                        >
                          <HoverCardTrigger asChild>
                            <button
                              onClick={() => handleSelectExisting(campaign)}
                              className={cn(
                                "bg-background flex items-center gap-3 p-3 rounded-lg border hover:bg-background/50 transition-colors text-left w-full",
                                isSelected && "border-2 border-primary",
                              )}
                            >
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <p className="font-medium truncate">
                                    {campaign.title}
                                  </p>
                                  {defaultsCount > 0 && (
                                    <Badge
                                      variant="secondary"
                                      className="text-[10px] px-1.5 py-0 shrink-0"
                                    >
                                      <Sparkles className="w-2.5 h-2.5 mr-0.5" />
                                      {defaultsCount}
                                    </Badge>
                                  )}
                                </div>
                                <p className="text-sm text-muted-foreground truncate">
                                  {t("link-count", {
                                    count: campaign.linksCount,
                                  })}
                                  {campaign.description &&
                                    ` • ${campaign.description}`}
                                </p>
                              </div>
                              <Check
                                className={cn(
                                  "h-4 w-4 shrink-0",
                                  isSelected ? "opacity-100" : "opacity-0",
                                )}
                              />
                            </button>
                          </HoverCardTrigger>
                          {(campaign.utmDefaults || campaign.description) && (
                            <HoverCardContent side="right" className="w-72">
                              <div className="flex flex-col gap-3">
                                {campaign.description && (
                                  <p className="text-sm text-muted-foreground">
                                    {campaign.description}
                                  </p>
                                )}
                                {campaign.utmDefaults && defaultsCount > 0 && (
                                  <div className="space-y-2">
                                    <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                                      <Sparkles className="w-3 h-3" />
                                      {t("utm-defaults")}
                                    </p>
                                    <div className="flex flex-wrap gap-1">
                                      {campaign.utmDefaults.sources?.map(
                                        (s) => (
                                          <Badge
                                            key={`source-${s}`}
                                            variant="outline"
                                            className="text-[10px]"
                                          >
                                            source: {s}
                                          </Badge>
                                        ),
                                      )}
                                      {campaign.utmDefaults.mediums?.map(
                                        (m) => (
                                          <Badge
                                            key={`medium-${m}`}
                                            variant="outline"
                                            className="text-[10px]"
                                          >
                                            medium: {m}
                                          </Badge>
                                        ),
                                      )}
                                      {campaign.utmDefaults.terms?.map((t) => (
                                        <Badge
                                          key={`term-${t}`}
                                          variant="outline"
                                          className="text-[10px]"
                                        >
                                          term: {t}
                                        </Badge>
                                      ))}
                                      {campaign.utmDefaults.contents?.map(
                                        (c) => (
                                          <Badge
                                            key={`content-${c}`}
                                            variant="outline"
                                            className="text-[10px]"
                                          >
                                            content: {c}
                                          </Badge>
                                        ),
                                      )}
                                    </div>
                                  </div>
                                )}
                                <Link
                                  href={`/dashboard/campaigns/${campaign._id}`}
                                  className="text-xs text-primary hover:underline flex items-center gap-1"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <ExternalLink className="w-3 h-3" />
                                  {t("view-campaign")}
                                </Link>
                              </div>
                            </HoverCardContent>
                          )}
                        </HoverCard>
                      );
                    })}
                  </div>
                </ScrollArea>
              )}
              {selectedCampaign?.title && (
                <Button
                  variant="outline"
                  onClick={() => {
                    onSelect(undefined);
                    setOpen(false);
                  }}
                >
                  {t("clear-selection")}
                </Button>
              )}
            </div>
          </TabsContent>
          <TabsContent value="create">
            <div className="flex flex-col gap-3">
              <h3 className="text-sm font-semibold">{t("create-new")}</h3>
              <Form {...campaignForm}>
                <form className="flex flex-col gap-3">
                  <FormField
                    control={campaignForm.control}
                    name="title"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("form.name-label")}</FormLabel>
                        <FormControl>
                          <Input
                            placeholder={t("form.name-placeholder")}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormRootError />
                  <Button
                    type="button"
                    onClick={handleCreateNew}
                    disabled={creating}
                  >
                    {creating ? (
                      <>
                        {t("form.creating")}
                        <Spinner className="h-4 w-4" />
                      </>
                    ) : (
                      <>
                        {t("form.create-and-select")}
                        <Plus className="h-4 w-4" />
                      </>
                    )}
                  </Button>
                </form>
              </Form>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
