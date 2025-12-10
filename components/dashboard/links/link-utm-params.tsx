"use client";

import { updateUTM } from "@/app/actions/linkActions";
import { Button } from "@/components/ui/button";
import { CardDescription, CardTitle } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Command,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { Input } from "@/components/ui/input";
import { Popover, PopoverTrigger } from "@/components/ui/popover";
import { ScrollPopoverContent } from "@/components/ui/scroll-popover-content";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Link } from "@/i18n/navigation";
import { cn, fetchApi } from "@/lib/utils";
import { ICampaign } from "@/models/url/Campaigns";
import { TUrl } from "@/models/url/UrlV3";
import { useUser } from "@/utils/UserContext";
import {
  Check,
  CheckCircle,
  ChevronDown,
  Copy,
  LinkIcon,
  Loader2,
  LockIcon,
  Plus,
  Trash2,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

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
  const [campaignOpen, campaignOpenChange] = useState(false);
  const [input, setInput] = useState("");
  const [campaignOptions, setCampaignOptions] = useState<ICampaign[]>([]);
  const [collapsed, setCollapsed] = useState(-1);
  const session = useUser();
  const hasExactMatch = campaignOptions.some(
    (campaign) => campaign.title === input,
  );
  const shouldShowAddCampaign =
    input != "" && (!hasExactMatch || campaignOptions.length === 0);
  useEffect(() => {
    if (!session.user) {
      return;
    }

    const delayDebounce = setTimeout(() => {
      if (input.trim() === "") {
        fetchApi<{ campaigns: ICampaign[] }>("campaigns").then((res) => {
          if (res.success) {
            setCampaignOptions(res.campaigns);
          } else {
            setCampaignOptions([]);
          }
        });
        return;
      }
      fetchApi<{ campaigns: ICampaign[] }>(`campaigns?q=${input}`).then(
        (res) => {
          if (res.success) {
            setCampaignOptions(res.campaigns);
          } else {
            setCampaignOptions([]);
          }
        },
      );
    }, 300);

    return () => clearTimeout(delayDebounce);
  }, [input, session.user]);

  if (!unlocked) {
    return (
      <div className="lg:p-6 sm:p-4 p-3 rounded bg-background shadow w-full flex flex-col gap-0">
        <div className="w-full flex flex-col gap-1 items-start text-left">
          <CardTitle className="flex flex-row items-center gap-2">
            <Switch disabled />
            UTM Parameters
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
          UTM Parameters
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
            const builtHref = buildUrl(link.shortUrl, utmSection);
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
                    <Link href={builtHref} className="text-sm truncate w-full">
                      {builtHref.split("//")[1]}
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
                    {collapsed == indx && (
                      <div className="xs:col-span-3 col-span-2">
                        <Popover
                          open={campaignOpen}
                          onOpenChange={campaignOpenChange}
                        >
                          <PopoverTrigger asChild>
                            <div className="w-full relative">
                              <Input
                                readOnly
                                value={
                                  utmSection.campaign?.title ??
                                  "Select or create a campaign"
                                }
                                className="text-left pl-6 cursor-pointer"
                              />
                              <ChevronDown className="w-4 h-4 left-1.5 top-1/2 -translate-y-1/2 absolute" />
                            </div>
                          </PopoverTrigger>
                          <ScrollPopoverContent
                            align="start"
                            side="bottom"
                            className="w-full min-w-[250px] p-0"
                          >
                            <Command className="w-full">
                              <CommandInput
                                value={input}
                                aria-invalid={
                                  !/^[A-Za-z0-9 _-]*$/.test(
                                    utmSection.campaign?.title ?? "",
                                  )
                                }
                                onValueChange={(e) => {
                                  const value = e;
                                  if (!/^[A-Za-z0-9 _-]*$/.test(value)) return;
                                  setInput(value);
                                }}
                                className="w-full has-[aria-invalid=true]:border-destructive"
                                placeholder="ex: Black friday 2025"
                              />
                              <CommandList className="items-stretch flex flex-col gap-1 w-full">
                                <CommandGroup className="w-full">
                                  {campaignOptions.map((campaign) => (
                                    <CommandItem
                                      className="w-full! max-w-full! justify-center gap-1"
                                      key={campaign._id as string}
                                      value={campaign.title}
                                      onSelect={async () => {
                                        const added =
                                          utmSection.campaign?.title ==
                                          campaign.title;
                                        if (added) {
                                          updateUtm((prev) =>
                                            prev.map((pUTM, pIndx) =>
                                              pIndx == indx
                                                ? {
                                                    ...pUTM,
                                                    campaign: {
                                                      _id: undefined,
                                                      title: "",
                                                    },
                                                  }
                                                : pUTM,
                                            ),
                                          );
                                          campaignOpenChange(false);
                                          return;
                                        }
                                        updateUtm((prev) =>
                                          prev.map((pUTM, pIndx) =>
                                            pIndx == indx
                                              ? {
                                                  ...pUTM,
                                                  campaign: {
                                                    _id: campaign?._id,
                                                    title: campaign.title,
                                                  },
                                                }
                                              : pUTM,
                                          ),
                                        );
                                        campaignOpenChange(false);
                                      }}
                                    >
                                      {campaign.title}
                                      <Check
                                        className={cn(
                                          "ml-auto",
                                          utm[indx].campaign?.title ==
                                            campaign.title
                                            ? "opacity-100"
                                            : "opacity-0",
                                        )}
                                      />
                                    </CommandItem>
                                  ))}
                                  {shouldShowAddCampaign && (
                                    <CommandItem
                                      className="w-full! max-w-full! justify-center gap-1"
                                      key={input}
                                      value={input}
                                      onSelect={async () => {
                                        updateUtm((prev) =>
                                          prev.map((pUTM, pIndx) =>
                                            pIndx == indx
                                              ? {
                                                  ...pUTM,
                                                  campaign: {
                                                    _id: pUTM.campaign?._id,
                                                    title: input,
                                                  },
                                                }
                                              : pUTM,
                                          ),
                                        );
                                        campaignOpenChange(false);
                                      }}
                                    >
                                      Create &quot;{input}&quot;
                                    </CommandItem>
                                  )}
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </ScrollPopoverContent>
                        </Popover>
                      </div>
                    )}

                    <div className="col-span-1 text-left flex justify-start text-sm font-semibold items-center px-2 bg-muted border rounded shadow">
                      <p>Source</p>
                    </div>
                    <div className="xs:col-span-3 col-span-2">
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
                              pIndx == indx ? { ...pUTM, source: value } : pUTM,
                            ),
                          );
                        }}
                        className="w-full has-[aria-invalid=true]:border-destructive"
                        placeholder="ex: newsletter"
                      />
                    </div>
                    <div className="col-span-1 text-left flex justify-start text-sm font-semibold items-center px-2 bg-muted border rounded shadow">
                      <p>Medium</p>
                    </div>
                    <div className="xs:col-span-3 col-span-2">
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
                              pIndx == indx ? { ...pUTM, medium: value } : pUTM,
                            ),
                          );
                        }}
                        className="w-full has-[aria-invalid=true]:border-destructive"
                        placeholder="ex: email"
                      />
                    </div>
                    <div className="col-span-1 text-left flex justify-start text-sm font-semibold items-center px-2 bg-muted border rounded shadow">
                      <p>Term</p>
                    </div>
                    <div className="xs:col-span-3 col-span-2">
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
                        className="w-full has-[aria-invalid=true]:border-destructive"
                        placeholder="ex: discount"
                      />
                    </div>
                    <div className="col-span-1 text-left flex justify-start text-sm font-semibold items-center px-2 bg-muted border rounded shadow">
                      <p>Content</p>
                    </div>
                    <div className="xs:col-span-3 col-span-2">
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
                        className="w-full has-[aria-invalid=true]:border-destructive"
                        placeholder="ex: cta-button"
                      />
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
