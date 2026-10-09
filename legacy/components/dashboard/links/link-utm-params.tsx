"use client";

import { updateUTM, getCampaignByTitle } from "@/app/actions/linkActions";
import { Button } from "@/components/ui/button";
import { CardDescription, CardTitle } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Link } from "@/i18n/navigation";
import { TUrl } from "@/models/url/UrlV3";
import { getShortUrl } from "@/lib/utils";
import {
  CheckCircle,
  ChevronDown,
  Copy,
  LinkIcon,
  Loader2,
  LockIcon,
  Plus,
  Trash2,
  Sparkles,
} from "lucide-react";
import { useState, useCallback } from "react";
import { toast } from "sonner";
import { CampaignSelectorDialog } from "./campaign-selector-dialog";
import { IUtmDefaults } from "@/models/url/Campaigns";
function buildUrl(
  link: string,
  utm?: {
    source?: string;
    medium?: string;
    campaign?: {
      _id: unknown;
      title: string;
    };
    term?: string;
    content?: string;
  },
) {
  if (!utm) return link;

  const params = new URLSearchParams();

  if (utm.source) params.set("utm_source", utm.source);
  if (utm.medium) params.set("utm_medium", utm.medium);
  if (utm.campaign?.title) params.set("utm_campaign", utm.campaign.title);
  if (utm.term) params.set("utm_term", utm.term);
  if (utm.content) params.set("utm_content", utm.content);

  if ([...params].length === 0) return link;

  const separator = link.includes("?") ? "&" : "?";
  return `${link}${separator}${params.toString()}`;
}

export const LinkUtmParams = ({
  currentLink,
  unlocked,
}: {
  currentLink: TUrl;
  unlocked: boolean;
}) => {
  const shortUrl = getShortUrl(currentLink.urlCode);
  const [link, updateLink] = useState(currentLink);
  const [justCopied, setJustCopied] = useState(-1);
  const [utm, updateUtm] = useState<
    {
      source?: string;
      medium?: string;
      campaign?: {
        _id: unknown;
        title: string;
      };
      term?: string;
      content?: string;
    }[]
  >(currentLink.utmLinks ?? []);
  const [toggled, setToggled] = useState(
    (currentLink.utmLinks?.length ?? 0) > 0,
  );
  const [saving, setSaving] = useState(false);
  const [collapsed, setCollapsed] = useState(-1);
  const [campaignDefaults, setCampaignDefaults] = useState<
    Record<number, IUtmDefaults | null>
  >({});
  const [loadingDefaults, setLoadingDefaults] = useState<
    Record<number, boolean>
  >({});

  const fetchCampaignDefaults = useCallback(
    async (campaignTitle: string, index: number) => {
      setLoadingDefaults((prev) => ({ ...prev, [index]: true }));
      try {
        const result = await getCampaignByTitle({ title: campaignTitle });
        if (result.success && result.campaign?.utmDefaults) {
          setCampaignDefaults((prev) => ({
            ...prev,
            [index]: result.campaign!.utmDefaults!,
          }));
        } else {
          setCampaignDefaults((prev) => ({ ...prev, [index]: null }));
        }
      } catch {
        setCampaignDefaults((prev) => ({ ...prev, [index]: null }));
      } finally {
        setLoadingDefaults((prev) => ({ ...prev, [index]: false }));
      }
    },
    [],
  );

  const applyDefaultValue = (
    index: number,
    field: "source" | "medium" | "term" | "content",
    value: string,
  ) => {
    updateUtm((prev) =>
      prev.map((pUTM, pIndx) =>
        pIndx === index ? { ...pUTM, [field]: value } : pUTM,
      ),
    );
  };

  if (!unlocked) {
    return (
      <div className="lg:p-6 sm:p-4 p-3 rounded bg-background shadow w-full flex flex-col gap-0">
        <div className="w-full flex flex-col gap-1 items-start text-left">
          <CardTitle className="flex flex-row items-center gap-2">
            <Switch disabled />
            UTM Parameters (Campaigns)
            <HoverCard>
              <HoverCardTrigger asChild>
                <LockIcon className="w-3.5 h-3.5 shrink-0" />
              </HoverCardTrigger>
              <HoverCardContent asChild>
                <div className="w-full max-w-[300px] p-2! px-3! rounded bg-primary text-primary-foreground flex flex-col gap-0 items-start text-xs cursor-help">
                  <p className="text-sm font-bold">Unlock UTM params.</p>
                  <p>
                    <Link
                      className="underline hover:cursor-pointer"
                      href={`/dashboard/subscription`}
                    >
                      Upgrade
                    </Link>{" "}
                    to access UTM parameters.
                  </p>
                </div>
              </HoverCardContent>
            </HoverCard>
          </CardTitle>
          <CardDescription>
            These are special campaigns added to your links that you can use to
            better track engagement sources. You can also associate this link to
            a campaign.
          </CardDescription>
        </div>
      </div>
    );
  }
  return (
    <div className="lg:p-6 sm:p-4 p-3 rounded bg-background shadow w-full flex flex-col gap-0">
      <div className="w-full flex flex-col gap-1 items-start text-left">
        <CardTitle className="flex flex-row items-center gap-2">
          <Switch
            checked={toggled}
            onCheckedChange={(c) => {
              setToggled(c);
              if (c) {
                if (!link.utmLinks || link.utmLinks.length == 0) {
                  const newUTM = [
                    {
                      campaign: undefined,
                      source: "",
                      medium: "",
                      content: "",
                      term: "",
                    },
                  ];
                  updateLink((prev) => ({
                    ...prev,
                    utmLinks: newUTM,
                  }));
                  updateUtm(newUTM);
                } else {
                  updateUtm(link.utmLinks);
                }
              }
            }}
          />
          UTM Parameters (Campaigns)
        </CardTitle>
        <CardDescription>
          These are special campaigns added to your links that you can use to
          better track engagement sources. You can also associate this link to a
          campaign.
        </CardDescription>
      </div>
      {utm && toggled && (
        <>
          <Separator className="mt-2" />
          {utm.map((utmSection, indx) => {
            const builtHref = buildUrl(shortUrl, utmSection);
            const handleCopy = async () => {
              await navigator.clipboard.writeText(builtHref);
              setJustCopied(indx);
              setTimeout(() => {
                setJustCopied(-1);
              }, 1000);
            };
            return (
              <Collapsible
                defaultOpen={indx == 0}
                open={collapsed == indx}
                onOpenChange={(o) => {
                  if (o) {
                    setCollapsed(indx);
                  } else {
                    setCollapsed(-1);
                  }
                }}
                key={`utm-${indx}`}
                className="flex flex-col gap-2 w-full group mt-2"
              >
                <div className="flex flex-row items-center gap-1 w-full">
                  <CollapsibleTrigger asChild>
                    <Button
                      variant={"outline"}
                      className="shrink-0 w-fit! p-1!"
                    >
                      <ChevronDown className="transition-transform duration-300 ease-in-out group-data-[state=open]:rotate-180" />
                    </Button>
                  </CollapsibleTrigger>
                  <div className="bg-muted rounded shadow flex items-center gap-2 justify-start px-2 py-1 h-full border w-full truncate">
                    <LinkIcon className="w-3.5 h-3.5 shrink-0" />
                    <Link
                      prefetch={false}
                      href={builtHref}
                      className="text-sm truncate w-full"
                    >
                      {builtHref.replace("www.", "").split("://")[1]}
                    </Link>
                  </div>
                  <Button
                    onClick={handleCopy}
                    variant={"outline"}
                    className="shrink-0"
                  >
                    {justCopied == indx ? <CheckCircle /> : <Copy />}
                  </Button>
                  <Button
                    onClick={() => {
                      updateUtm((prev) =>
                        prev.filter((_, pIndx) => pIndx != indx),
                      );
                    }}
                    variant={"outline"}
                    className="shrink-0"
                  >
                    <Trash2 />
                  </Button>
                </div>

                <CollapsibleContent asChild>
                  <div className="grid xs:grid-cols-4 grid-cols-3 gap-2">
                    <div className="col-span-1 text-left flex justify-start text-sm font-semibold items-center px-2 bg-muted border rounded shadow">
                      <p>Campaign</p>
                    </div>
                    <div className="xs:col-span-3 col-span-2">
                      <CampaignSelectorDialog
                        selectedCampaign={utmSection.campaign}
                        onSelect={(campaign) => {
                          updateUtm((prev) =>
                            prev.map((pUTM, pIndx) =>
                              pIndx == indx
                                ? {
                                    ...pUTM,
                                    campaign: campaign
                                      ? {
                                          _id: campaign._id,
                                          title: campaign.title,
                                        }
                                      : { _id: undefined, title: "" },
                                  }
                                : pUTM,
                            ),
                          );
                          if (campaign?.title) {
                            fetchCampaignDefaults(campaign.title, indx);
                          } else {
                            setCampaignDefaults((prev) => ({
                              ...prev,
                              [indx]: null,
                            }));
                          }
                        }}
                        trigger={
                          <div className="w-full relative cursor-pointer">
                            <Input
                              readOnly
                              value={
                                utmSection.campaign?.title ||
                                "Select or create a campaign"
                              }
                              className="text-left pl-6 cursor-pointer"
                            />
                            <ChevronDown className="w-4 h-4 left-1.5 top-1/2 -translate-y-1/2 absolute" />
                          </div>
                        }
                      />
                      {loadingDefaults[indx] && (
                        <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                          <Loader2 className="w-3 h-3 animate-spin" />
                          Loading campaign defaults...
                        </div>
                      )}
                      {campaignDefaults[indx] && !loadingDefaults[indx] && (
                        <div className="flex items-center gap-1.5 mt-1.5">
                          <Sparkles className="w-3.5 h-3.5 text-primary" />
                          <span className="text-xs text-muted-foreground">
                            Campaign has UTM defaults available
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="col-span-1 text-left flex justify-start text-sm font-semibold items-center px-2 bg-muted border rounded shadow">
                      <p>Source</p>
                    </div>
                    <div className="xs:col-span-3 col-span-2">
                      <div className="flex gap-2">
                        <Input
                          aria-invalid={/[^a-zA-Z0-9-_]/.test(
                            utmSection.source ?? "",
                          )}
                          type="text"
                          value={utmSection.source ?? ""}
                          onChange={(e) => {
                            const value = e.target.value.trim().toLowerCase();
                            if (/[^a-zA-Z0-9-_]/.test(value)) return;
                            updateUtm((prev) =>
                              prev.map((pUTM, pIndx) =>
                                pIndx == indx
                                  ? { ...pUTM, source: value }
                                  : pUTM,
                              ),
                            );
                          }}
                          className="flex-1 has-[aria-invalid=true]:border-destructive"
                          placeholder="ex: newsletter"
                        />
                        {campaignDefaults[indx]?.sources &&
                          campaignDefaults[indx]!.sources.length > 0 && (
                            <Select
                              onValueChange={(v) =>
                                applyDefaultValue(indx, "source", v)
                              }
                            >
                              <SelectTrigger className="w-auto min-w-[100px]">
                                <SelectValue placeholder="Defaults" />
                              </SelectTrigger>
                              <SelectContent>
                                {campaignDefaults[indx]!.sources.map((s) => (
                                  <SelectItem key={s} value={s}>
                                    {s}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                      </div>
                    </div>
                    <div className="col-span-1 text-left flex justify-start text-sm font-semibold items-center px-2 bg-muted border rounded shadow">
                      <p>Medium</p>
                    </div>
                    <div className="xs:col-span-3 col-span-2">
                      <div className="flex gap-2">
                        <Input
                          type="text"
                          aria-invalid={/[^a-zA-Z0-9-_]/.test(
                            utmSection.medium ?? "",
                          )}
                          value={utmSection.medium ?? ""}
                          onChange={(e) => {
                            const value = e.target.value.trim().toLowerCase();
                            if (/[^a-zA-Z0-9-_]/.test(value)) return;
                            updateUtm((prev) =>
                              prev.map((pUTM, pIndx) =>
                                pIndx == indx
                                  ? { ...pUTM, medium: value }
                                  : pUTM,
                              ),
                            );
                          }}
                          className="flex-1 has-[aria-invalid=true]:border-destructive"
                          placeholder="ex: email"
                        />
                        {campaignDefaults[indx]?.mediums &&
                          campaignDefaults[indx]!.mediums.length > 0 && (
                            <Select
                              onValueChange={(v) =>
                                applyDefaultValue(indx, "medium", v)
                              }
                            >
                              <SelectTrigger className="w-auto min-w-[100px]">
                                <SelectValue placeholder="Defaults" />
                              </SelectTrigger>
                              <SelectContent>
                                {campaignDefaults[indx]!.mediums.map((m) => (
                                  <SelectItem key={m} value={m}>
                                    {m}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                      </div>
                    </div>
                    <div className="col-span-1 text-left flex justify-start text-sm font-semibold items-center px-2 bg-muted border rounded shadow">
                      <p>Term</p>
                    </div>
                    <div className="xs:col-span-3 col-span-2">
                      <div className="flex gap-2">
                        <Input
                          aria-invalid={/[^a-zA-Z0-9-_]/.test(
                            utmSection.term ?? "",
                          )}
                          type="text"
                          value={utmSection.term ?? ""}
                          onChange={(e) => {
                            const value = e.target.value.trim().toLowerCase();
                            if (/[^a-zA-Z0-9-_]/.test(value)) return;
                            updateUtm((prev) =>
                              prev.map((pUTM, pIndx) =>
                                pIndx == indx ? { ...pUTM, term: value } : pUTM,
                              ),
                            );
                          }}
                          className="flex-1 has-[aria-invalid=true]:border-destructive"
                          placeholder="ex: discount"
                        />
                        {campaignDefaults[indx]?.terms &&
                          campaignDefaults[indx]!.terms.length > 0 && (
                            <Select
                              onValueChange={(v) =>
                                applyDefaultValue(indx, "term", v)
                              }
                            >
                              <SelectTrigger className="w-auto min-w-[100px]">
                                <SelectValue placeholder="Defaults" />
                              </SelectTrigger>
                              <SelectContent>
                                {campaignDefaults[indx]!.terms.map((t) => (
                                  <SelectItem key={t} value={t}>
                                    {t}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                      </div>
                    </div>
                    <div className="col-span-1 text-left flex justify-start text-sm font-semibold items-center px-2 bg-muted border rounded shadow">
                      <p>Content</p>
                    </div>
                    <div className="xs:col-span-3 col-span-2">
                      <div className="flex gap-2">
                        <Input
                          aria-invalid={/[^a-zA-Z0-9-_]/.test(
                            utmSection.content ?? "",
                          )}
                          type="text"
                          value={utmSection.content ?? ""}
                          onChange={(e) => {
                            const value = e.target.value.trim().toLowerCase();
                            if (/[^a-zA-Z0-9-_]/.test(value)) return;
                            updateUtm((prev) =>
                              prev.map((pUTM, pIndx) =>
                                pIndx == indx
                                  ? { ...pUTM, content: value }
                                  : pUTM,
                              ),
                            );
                          }}
                          className="flex-1 has-[aria-invalid=true]:border-destructive"
                          placeholder="ex: cta-button"
                        />
                        {campaignDefaults[indx]?.contents &&
                          campaignDefaults[indx]!.contents.length > 0 && (
                            <Select
                              onValueChange={(v) =>
                                applyDefaultValue(indx, "content", v)
                              }
                            >
                              <SelectTrigger className="w-auto min-w-[100px]">
                                <SelectValue placeholder="Defaults" />
                              </SelectTrigger>
                              <SelectContent>
                                {campaignDefaults[indx]!.contents.map((c) => (
                                  <SelectItem key={c} value={c}>
                                    {c}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                      </div>
                    </div>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            );
          })}
          <Button
            disabled={utm != link.utmLinks}
            onClick={() => {
              updateUtm((prev) => {
                const newUTM = [
                  ...prev,
                  {
                    campaign: undefined,
                    source: "",
                    medium: "",
                    content: "",
                    term: "",
                  },
                ];
                return newUTM;
              });
              setCollapsed(utm.length);
            }}
            className="w-fit! p-1! mt-2"
            variant={"outline"}
          >
            <Plus />
          </Button>
          <div className="grid grid-cols-2 gap-4 mt-4">
            <Button
              onClick={async () => {
                const isValid = utm.every((section) => {
                  return (
                    section.source?.trim() ||
                    section.content?.trim() ||
                    section.term?.trim() ||
                    section.medium?.trim() ||
                    section.campaign?.title?.trim()
                  );
                });
                if (!isValid) {
                  toast.error("Please fill in at least one UTM parameter");
                  return;
                }
                setSaving(true);
                const response = await updateUTM({
                  urlCode: link.urlCode,
                  utm,
                });
                if (!response.success) {
                  toast.error("There was a problem updating your link.");
                  setSaving(false);
                  return;
                }
                if (!response.newUrl) {
                  toast.error("There was a problem updating your link.");
                  setSaving(false);
                  return;
                }
                updateLink(response.newUrl);
                updateUtm(response.newUrl.utmLinks ?? []);
                if ((response.newUrl.utmLinks ?? []).length == 0) {
                  setToggled(false);
                }
                setSaving(false);
                toast.success("Successfully updated UTM Links.");
              }}
              className="w-full"
              disabled={utm == link.utmLinks || saving}
            >
              {saving ? (
                <>
                  <Loader2 className="animate-spin" /> Saving...
                </>
              ) : (
                `Save`
              )}
            </Button>
            <Button
              className="w-full"
              disabled={utm == link.utmLinks || saving}
              onClick={() => {
                updateUtm(
                  link.utmLinks ?? [
                    {
                      campaign: undefined,
                      source: "",
                      medium: "",
                      content: "",
                      term: "",
                    },
                  ],
                );
              }}
              variant={"secondary"}
            >
              Cancel
            </Button>
          </div>
        </>
      )}
    </div>
  );
};
