"use client";

import {
  Command,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { getCurrentUsage, UsageData } from "@/app/actions/usageActions";
import { Button } from "@/components/ui/button";
import { updateQRCodeData } from "@/app/actions/qrCodeActions";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Link, useRouter } from "@/i18n/navigation";
import { IQRCode } from "@/models/url/QRCodeV2";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState, useEffect, useCallback } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Label } from "@/components/ui/label";
import { Popover, PopoverTrigger } from "@/components/ui/popover";
import { cn, fetchApi } from "@/lib/utils";
import { Check, ChevronsUpDown, LockIcon, X } from "lucide-react";
import { createTag } from "@/app/actions/tagActions";
import { ITag } from "@/models/url/Tag";
import { Switch } from "@/components/ui/switch";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollPopoverContent } from "@/components/ui/scroll-popover-content";
import { authClient } from "@/lib/authClient";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { usePlan } from "@/hooks/use-plan";
import { useTranslations } from "next-intl";

export const QRCodeEditContent = ({ qrCode }: { qrCode: IQRCode }) => {
  const t = useTranslations("qr-code-edit");

  const qrCodeFormSchema = z.object({
    title: z
      .string()
      .min(3, t("validation.title-too-short"))
      .max(52, t("validation.title-too-long")),
    applyToLink: z.boolean().default(false).optional(),
    longUrl: z.string().url(t("validation.invalid-url")),
  });

  const { data, refetch } = authClient.useSession();
  const user = data?.user;
  const { plan } = usePlan();

  const [usage, setUsage] = useState<UsageData | null>(null);

  const fetchUsage = useCallback(async () => {
    const result = await getCurrentUsage();
    if (result.success && result.data) setUsage(result.data);
  }, []);

  useEffect(() => {
    void fetchUsage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const router = useRouter();

  const [creating, setCreating] = useState(false);

  const qrCodeForm = useForm<z.infer<typeof qrCodeFormSchema>>({
    resolver: zodResolver(qrCodeFormSchema),
    defaultValues: {
      title: qrCode.title,
      applyToLink: false,
      longUrl: qrCode.longUrl,
    },
  });

  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [tagOptions, setTagOptions] = useState<ITag[]>([]);

  const [tags, setTags] = useState<ITag[]>((qrCode.tags as ITag[]) || []);

  const hasExactMatch = tagOptions.some((tag) => tag.tagName === input);

  const shouldShowAddTag =
    input != "" && (!hasExactMatch || tagOptions.length === 0);

  const isMobile = useIsMobile();

  useEffect(() => {
    if (!user) {
      return;
    }

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
  }, [input, user]);

  useEffect(() => {
    if (!user) {
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
  }, [input, user]);

  if (!qrCode) {
    return <Skeleton className="w-full col-span-full aspect-video h-auto" />;
  }
  return (
    <div className="w-full flex flex-col gap-6 items-start col-span-full">
      <h1 className="font-bold lg:text-3xl md:text-2xl sm:text-xl text-lg">
        {t("title")}
      </h1>
      <div className="rounded bg-background lg:p-6 md:p-4 p-3 w-full flex flex-col gap-4">
        <div className="flex flex-col gap-2 items-start">
          <h1 className="lg:text-2xl md:text-xl sm:text-lg text-base font-bold">
            {t("details")}
          </h1>
        </div>
        <Form {...qrCodeForm}>
          <form
            onSubmit={qrCodeForm.handleSubmit(async (data) => {
              setCreating(true);
              const { success, message } = await updateQRCodeData({
                qrCodeId: qrCode.qrCodeId,
                title: data.title,
                tags: tags,
                applyToLink: data.applyToLink ?? false,
                longUrl: data.longUrl,
              });
              if (success) {
                await refetch();
                router.push(`/dashboard/qr-codes/${qrCode.qrCodeId}/details`);
                return;
              } else {
                switch (message) {
                  case "redirect-plan-limit":
                    qrCodeForm.setError("longUrl", {
                      type: "manual",
                      message: t("error-redirect-limit"),
                    });
                    break;
                  default:
                    qrCodeForm.setError("title", {
                      type: "manual",
                      message: t("error-updating"),
                    });
                }
              }
              setCreating(false);
            })}
            className="w-full flex flex-col gap-4"
          >
            <FormField
              control={qrCodeForm.control}
              name="title"
              render={({ field }) => (
                <FormItem className="w-full">
                  <FormLabel>{t("title-label")}</FormLabel>
                  <FormControl>
                    <Input className="w-full" placeholder="" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="w-full flex flex-col gap-2">
              <Label className="font-semibold">{t("tags")}</Label>

              {isMobile ? (
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
                                    "bg-secondary text-secondary-foreground shadow-xs hover:bg-secondary/80 h-full! p-1! text-sm rounded-none! hover:cursor-pointer",
                                  )}
                                >
                                  {tag.tagName}
                                  <X className="w-3! h-3!" />
                                </p>
                              );
                            })
                          : t("add-tags")}
                      </div>

                      <ChevronsUpDown className="opacity-50" />
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="w-full min-w-[250px] p-0 pt-6">
                    <DialogHeader className="px-4 text-left">
                      <DialogTitle>{t("edit-tags")}</DialogTitle>
                      <DialogDescription>
                        {t("tags-description")}
                      </DialogDescription>
                    </DialogHeader>
                    <Command className="w-full">
                      <CommandInput
                        value={input}
                        onValueChange={setInput}
                        placeholder={t("search-tags")}
                        className="h-9"
                      />
                      <CommandList className="items-stretch flex flex-col gap-1 w-full">
                        <CommandGroup className="w-full">
                          {tagOptions.map((tag) => (
                            <CommandItem
                              className="w-full! max-w-full! justify-center gap-1"
                              key={tag.id}
                              value={tag.tagName}
                              onSelect={async () => {
                                const added = tags?.some(
                                  (_tag) => _tag.id == tag.id,
                                );
                                if (added) {
                                  setTags((prev) => {
                                    const n = [...prev];
                                    const index = n.findIndex(
                                      (t) => t.id == tag.id,
                                    );
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
                                  tags?.some(
                                    (_tag) => _tag.tagName == tag.tagName,
                                  )
                                    ? "opacity-100"
                                    : "opacity-0",
                                )}
                              />
                            </CommandItem>
                          ))}
                          {shouldShowAddTag && (
                            <CommandItem
                              className="w-full! max-w-full! justify-center gap-1"
                              key={input}
                              value={input}
                              onSelect={async () => {
                                if (!user?.sub) return;
                                const response = await createTag(input);
                                if (response.success && response.tag) {
                                  setTags((prev) => {
                                    const n = [...prev, response.tag as ITag];
                                    return n;
                                  });
                                  setInput("");
                                }
                              }}
                            >
                              {t("create-tag", { name: input })}
                            </CommandItem>
                          )}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                    {tags != qrCode.tags && (
                      <div className="w-full flex flex-row items-center gap-2 justify-start px-2 pb-2 -mt-2">
                        <Button
                          onClick={() => {
                            setOpen(false);
                          }}
                        >
                          {t("save")}
                        </Button>
                        <Button
                          variant={"secondary"}
                          onClick={() => {
                            setTags(qrCode.tags as ITag[]);
                            setOpen(false);
                          }}
                        >
                          {t("cancel")}
                        </Button>
                      </div>
                    )}
                  </DialogContent>
                </Dialog>
              ) : (
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
                                    "bg-secondary text-secondary-foreground shadow-xs hover:bg-secondary/80 h-full! p-1! text-sm rounded-none! hover:cursor-pointer",
                                  )}
                                >
                                  {tag.tagName}
                                  <X className="w-3! h-3!" />
                                </p>
                              );
                            })
                          : t("add-tags")}
                      </div>

                      <ChevronsUpDown className="opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <ScrollPopoverContent
                    align="start"
                    side="bottom"
                    className="w-full min-w-[250px] p-0"
                  >
                    <Command className="w-full">
                      <CommandInput
                        value={input}
                        onValueChange={setInput}
                        placeholder={t("search-tags")}
                        className="h-9"
                      />
                      <CommandList className="items-stretch flex flex-col gap-1 w-full">
                        <CommandGroup className="w-full">
                          {tagOptions.map((tag) => (
                            <CommandItem
                              className="w-full! max-w-full! justify-center gap-1"
                              key={tag.id}
                              value={tag.tagName}
                              onSelect={async () => {
                                const added = tags?.some(
                                  (_tag) => _tag.id == tag.id,
                                );
                                if (added) {
                                  setTags((prev) => {
                                    const n = [...prev];
                                    const index = n.findIndex(
                                      (t) => t.id == tag.id,
                                    );
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
                                  tags?.some(
                                    (_tag) => _tag.tagName == tag.tagName,
                                  )
                                    ? "opacity-100"
                                    : "opacity-0",
                                )}
                              />
                            </CommandItem>
                          ))}
                          {shouldShowAddTag && (
                            <CommandItem
                              className="w-full! max-w-full! justify-center gap-1"
                              key={input}
                              value={input}
                              onSelect={async () => {
                                if (!user?.sub) return;
                                const response = await createTag(input);
                                if (response.success && response.tag) {
                                  setTags((prev) => {
                                    const n = [...prev, response.tag as ITag];
                                    return n;
                                  });
                                  setInput("");
                                }
                              }}
                            >
                              {t("create-tag", { name: input })}
                            </CommandItem>
                          )}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </ScrollPopoverContent>
                </Popover>
              )}
            </div>
            <FormField
              control={qrCodeForm.control}
              name="longUrl"
              render={({ field }) => (
                <FormItem className="w-full">
                  <FormLabel>
                    {t("change-destination")}{" "}
                    {plan === "pro" || plan === "plus" ? (
                      <span className="text-muted-foreground">
                        (
                        {plan === "pro"
                          ? t("unlimited")
                          : Math.max(
                              (usage?.qrCodeRedirects.limit ?? 10) -
                                (usage?.qrCodeRedirects.consumed ?? 0),
                              0,
                            )}{" "}
                        {t("left")})
                      </span>
                    ) : (
                      <HoverCard>
                        <HoverCardTrigger>
                          <LockIcon className="w-3! h-3!" />
                        </HoverCardTrigger>
                        <HoverCardContent asChild>
                          <div className="w-full max-w-[300px] p-2! px-3! rounded bg-primary text-primary-foreground flex flex-col gap-0 items-start text-xs cursor-help">
                            <p className="text-sm font-bold">
                              {t("unlock-redirects")}
                            </p>
                            <p>
                              <Link
                                href={`/dashboard/subscription`}
                                className="underline hover:cursor-pointer"
                              >
                                {t("upgrade")}
                              </Link>{" "}
                              {t("to-change-destination")}
                            </p>
                          </div>
                        </HoverCardContent>
                      </HoverCard>
                    )}
                  </FormLabel>
                  <FormControl>
                    <Input
                      disabled={
                        ((usage?.qrCodeRedirects.consumed ?? 0) >=
                          (usage?.qrCodeRedirects.limit ?? 10) &&
                          plan == "plus") ||
                        (plan != "pro" && plan != "plus")
                      }
                      className="w-full"
                      placeholder=""
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {qrCode.attachedUrl && (
              <FormField
                control={qrCodeForm.control}
                name="applyToLink"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between">
                    <div className="space-y-0.5">
                      <FormLabel>{t("apply-to-shortn")}</FormLabel>
                      <FormDescription>
                        {t("apply-to-shortn-description")}
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            )}
            <div className="flex flex-row items-center justify-end gap-4 w-full">
              <Button
                onClick={() => {
                  router.push(`/dashboard/qr-codes`);
                }}
                type="button"
                variant={"secondary"}
              >
                {t("cancel")}
              </Button>
              <Button type="submit" disabled={creating}>
                {creating ? t("saving") : t("save-changes")}
              </Button>
            </div>
          </form>
        </Form>
      </div>
    </div>
  );
};
