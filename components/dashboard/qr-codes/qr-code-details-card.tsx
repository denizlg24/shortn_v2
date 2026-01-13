"use client";
import { useTranslations } from "next-intl";
import { createShortn, generateCSV } from "@/app/actions/linkActions";
import { attachShortnToQR, deleteQRCode } from "@/app/actions/qrCodeActions";
import {
  addTagToQRCode,
  createAndAddTagToUrl,
  removeTagFromQRCode,
} from "@/app/actions/tagActions";
import { getCurrentUsage, UsageData } from "@/app/actions/usageActions";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Popover, PopoverTrigger } from "@/components/ui/popover";
import { ScrollPopoverContent } from "@/components/ui/scroll-popover-content";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Link, useRouter } from "@/i18n/navigation";
import { cn, fetchApi } from "@/lib/utils";
import { TQRCode } from "@/models/url/QRCodeV2";
import { ITag } from "@/models/url/Tag";
import { format } from "date-fns";
import {
  Calendar,
  Check,
  CornerDownRight,
  Download,
  Edit2,
  Ellipsis,
  FileChartColumn,
  LinkIcon,
  Loader2,
  LockIcon,
  Palette,
  PlusCircle,
  Tags,
  Trash2,
} from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { getLinksLeft } from "../home/quick-create";
import { toast } from "sonner";
import { StyledQRCode } from "@/components/ui/styled-qr-code";
import QRCodeStyling from "qr-code-styling";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { authClient } from "@/lib/authClient";
import { usePlan } from "@/hooks/use-plan";

export const QRCodeDetailsCard = ({ qrCode }: { qrCode: TQRCode }) => {
  const t = useTranslations("qr-code-details-card");
  const { data } = authClient.useSession();
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

  const [currentQrCode, setCurrentQrCode] = useState<TQRCode>(qrCode);
  const [input, setInput] = useState("");
  const [tagOptions, setTagOptions] = useState<ITag[]>([]);
  const [tagOpen, tagOpenChange] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [styledCode, setStyledCode] = useState<QRCodeStyling | undefined>(
    undefined,
  );
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    setIsDeleting(true);
    const response = await deleteQRCode(currentQrCode.qrCodeId);
    if (response.success) {
      toast.success(
        t("delete-success", { title: currentQrCode.title || "Untitled" }),
      );
      router.push("/dashboard/qr-codes");
    } else {
      toast.error(t("delete-error"));
      setIsDeleting(false);
    }
  };

  const hasExactMatch = tagOptions.some((tag) => tag.tagName === input);

  const shouldShowAddTag =
    input != "" && (!hasExactMatch || tagOptions.length === 0);

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

  const router = useRouter();

  if (!user) {
    return <Skeleton className="w-full h-42 bg-background" />;
  }

  return (
    <div className="lg:p-6 sm:p-4 p-3 pt-6 rounded bg-background shadow w-full flex sm:flex-row flex-col-reverse items-start gap-4 justify-between overflow-x-hidden">
      <div className="w-full grow sm:max-w-[calc(100%-112px-8px-8px)] flex flex-col gap-0">
        <div className="w-full flex flex-row items-start sm:justify-between gap-2 justify-center">
          <h1 className="font-bold lg:text-2xl md:text-xl text-lg truncate">
            {currentQrCode.title}
          </h1>
          <div className="sm:flex hidden flex-row items-center gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant={"outline"} className="p-2! aspect-square!">
                  <Ellipsis />
                </Button>
              </PopoverTrigger>
              <ScrollPopoverContent className="w-[200px] flex flex-col px-0! py-1 gap-1">
                {currentQrCode.attachedUrl ? (
                  <Button
                    asChild
                    variant={"outline"}
                    className="w-full border-none! rounded-none! justify-start! shadow-none! "
                  >
                    <Link
                      href={`/dashboard/links/${currentQrCode.attachedUrl}/details`}
                    >
                      <LinkIcon /> {t("view-short-link")}
                    </Link>
                  </Button>
                ) : (
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button
                        onClick={() => {
                          setError("");
                        }}
                        variant={"outline"}
                        className="w-full border-none! rounded-none! justify-start! shadow-none! "
                      >
                        <LinkIcon /> {t("create-short-link")}
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle className="text-left!">
                          {t("create-link-dialog-title")}
                        </DialogTitle>
                        <DialogDescription asChild>
                          <div className="flex flex-row gap-1 w-full flex-wrap text-left!">
                            <p>{t("create-link-dialog-description")}</p>
                            {getLinksLeft(
                              plan,
                              usage?.qrCodes.consumed ?? 0,
                              true,
                            )}
                          </div>
                        </DialogDescription>
                      </DialogHeader>
                      <div className="w-full flex flex-col text-left gap-1 items-start">
                        <p className="font-semibold xs:text-base text-sm">
                          {t("destination")}
                        </p>
                        <p className="xs:text-sm text-xs">
                          {currentQrCode.longUrl}
                        </p>
                      </div>
                      <div className="w-full flex flex-col text-left gap-1 items-start">
                        <p className="font-semibold xs:text-base text-sm">
                          {t("title")}
                        </p>
                        <p className="xs:text-sm text-xs">
                          {currentQrCode.title}
                        </p>
                      </div>
                      <DialogFooter className="flex flex-row items-center justify-end gap-2">
                        <DialogClose asChild>
                          <Button variant={"secondary"}>{t("cancel")}</Button>
                        </DialogClose>
                        <Button
                          onClick={async () => {
                            setCreating(true);
                            const response = await createShortn({
                              longUrl: currentQrCode.longUrl,
                              title: currentQrCode.title,
                              tags: currentQrCode.tags?.map((t) => t.id),
                              qrCodeId: currentQrCode.qrCodeId,
                            });
                            if (!response.success) {
                              switch (response.message) {
                                case "no-user":
                                  setError(t("error-no-user"));
                                  setCreating(false);
                                  return;
                                case "custom-restricted":
                                  setError(t("error-custom-restricted"));
                                  setCreating(false);
                                  return;
                                case "plan-limit":
                                  setError(t("error-plan-limit"));
                                  setCreating(false);
                                  return;
                                default:
                                  setError(t("error-default"));
                                  setCreating(false);
                                  return;
                              }
                            }
                            if (response.success && response.data) {
                              const shortUrl = response.data.shortUrl;

                              await attachShortnToQR(
                                shortUrl,
                                currentQrCode.qrCodeId,
                              );
                              router.push(
                                `/dashboard/links/${shortUrl}/details`,
                              );
                            }
                          }}
                          disabled={creating}
                        >
                          {creating ? (
                            <>
                              <Loader2 className="animate-spin" />
                              {t("creating")}
                            </>
                          ) : (
                            <>{t("create-link")}</>
                          )}
                        </Button>
                        {error && (
                          <p className="text-sm font-semibold text-center mx-auto text-destructive">
                            {error}
                          </p>
                        )}
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                )}
                <Button
                  onClick={handleDelete}
                  disabled={isDeleting}
                  variant={"outline"}
                  className="w-full border-none! rounded-none! justify-start! shadow-none! "
                >
                  {isDeleting ? (
                    <>
                      <Loader2 className="animate-spin" /> {t("deleting")}
                    </>
                  ) : (
                    <>
                      <Trash2 /> {t("delete")}
                    </>
                  )}
                </Button>
                {plan != "pro" ? (
                  <HoverCard>
                    <HoverCardTrigger asChild>
                      <Button
                        variant={"outline"}
                        className="w-full border-none! rounded-none! justify-start! shadow-none! relative text-muted-foreground"
                      >
                        <FileChartColumn /> {t("export-raw-scan-data")}
                        <LockIcon className="ml-auto" />
                      </Button>
                    </HoverCardTrigger>
                    <HoverCardContent asChild>
                      <div className="w-full max-w-[300px] p-2! px-3! rounded bg-primary text-primary-foreground flex flex-col gap-0 items-start text-xs cursor-help">
                        <p className="text-sm font-bold">
                          {t("unlock-csv-data")}
                        </p>
                        <p>
                          <Link
                            className="underline hover:cursor-pointer"
                            href={`/dashboard/subscription`}
                          >
                            {t("upgrade")}
                          </Link>{" "}
                          {t("to-export-all-time-scan-data")}
                        </p>
                      </div>
                    </HoverCardContent>
                  </HoverCard>
                ) : (
                  <Button
                    onClick={async () => {
                      toast.promise<{ success: boolean; url: string }>(
                        async () => {
                          const response = await generateCSV({
                            code: currentQrCode.qrCodeId,
                            type: "scan",
                          });
                          return response;
                        },
                        {
                          loading: t("preparing-download"),
                          success: (response) => {
                            if (response.success) {
                              const a = document.createElement("a");
                              a.href = response.url;
                              a.download = `${currentQrCode.qrCodeId}-scans-${format(Date.now(), "dd-MM-yyyy")}.csv`;
                              a.click();
                              return t("download-ready");
                            }
                            return t("download-error");
                          },
                          error: t("download-error"),
                        },
                      );
                    }}
                    variant={"outline"}
                    className="w-full border-none! rounded-none! justify-start! shadow-none! relative"
                  >
                    <FileChartColumn /> {t("export-raw-scan-data")}
                  </Button>
                )}
              </ScrollPopoverContent>
            </Popover>
            <Button asChild variant={"outline"} className="p-2! aspect-square!">
              <Link
                href={`/dashboard/qr-codes/${currentQrCode.qrCodeId}/edit/customize`}
              >
                <Palette />
              </Link>
            </Button>
            <Button asChild variant={"outline"} className="p-2! aspect-square!">
              <Link
                href={`/dashboard/qr-codes/${currentQrCode.qrCodeId}/edit/content`}
              >
                <Edit2 />
              </Link>
            </Button>
            <Button
              onClick={() => {
                styledCode?.download({
                  name: `${currentQrCode.qrCodeId}`,
                  extension: "png",
                });
              }}
              variant={"outline"}
              className="p-2! aspect-square!"
            >
              <Download />
            </Button>
          </div>
        </div>

        <div className="sm:hidden flex flex-row items-center justify-center gap-4 mt-4">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant={"outline"} className="p-2! aspect-square!">
                <Ellipsis />
              </Button>
            </PopoverTrigger>
            <ScrollPopoverContent
              align="start"
              className="w-[200px] flex flex-col px-0! py-1 gap-1"
            >
              {currentQrCode.attachedUrl ? (
                <Button
                  asChild
                  variant={"outline"}
                  className="w-full border-none! rounded-none! justify-start! shadow-none! "
                >
                  <Link
                    href={`/dashboard/links/${currentQrCode.attachedUrl}/details`}
                  >
                    <LinkIcon /> {t("view-short-link")}
                  </Link>
                </Button>
              ) : (
                <Dialog>
                  <DialogTrigger asChild>
                    <Button
                      onClick={() => {
                        setError("");
                      }}
                      variant={"outline"}
                      className="w-full border-none! rounded-none! justify-start! shadow-none! "
                    >
                      <LinkIcon /> {t("create-short-link")}
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle className="text-left!">
                        {t("create-link-dialog-title")}
                      </DialogTitle>
                      <DialogDescription asChild>
                        <div className="flex flex-row gap-1 w-full flex-wrap text-left!">
                          <p>{t("create-link-dialog-description")}</p>
                          {getLinksLeft(
                            plan,
                            usage?.qrCodes.consumed ?? 0,
                            true,
                          )}
                        </div>
                      </DialogDescription>
                    </DialogHeader>
                    <div className="w-full flex flex-col text-left gap-1 items-start">
                      <p className="font-semibold xs:text-base text-sm">
                        {t("destination")}
                      </p>
                      <p className="xs:text-sm text-xs">
                        {currentQrCode.longUrl}
                      </p>
                    </div>
                    <div className="w-full flex flex-col text-left gap-1 items-start">
                      <p className="font-semibold xs:text-base text-sm">
                        {t("title")}
                      </p>
                      <p className="xs:text-sm text-xs">
                        {currentQrCode.title}
                      </p>
                    </div>
                    <DialogFooter className="flex flex-row items-center justify-end gap-2">
                      <DialogClose asChild>
                        <Button variant={"secondary"}>{t("cancel")}</Button>
                      </DialogClose>
                      <Button
                        onClick={async () => {
                          setCreating(true);
                          const response = await createShortn({
                            longUrl: currentQrCode.longUrl,
                            title: currentQrCode.title,
                            tags: currentQrCode.tags?.map((tg) => tg.id),
                            qrCodeId: currentQrCode.qrCodeId,
                          });
                          if (!response.success) {
                            switch (response.message) {
                              case "no-user":
                                setError(t("error-no-user"));
                                setCreating(false);
                                return;
                              case "custom-restricted":
                                setError(t("error-custom-restricted"));
                                setCreating(false);
                                return;
                              case "plan-limit":
                                setError(t("error-plan-limit"));
                                setCreating(false);
                                return;
                              default:
                                setError(t("error-default"));
                                setCreating(false);
                                return;
                            }
                          }
                          if (response.success && response.data) {
                            const shortUrl = response.data.shortUrl;

                            await attachShortnToQR(
                              shortUrl,
                              currentQrCode.qrCodeId,
                            );
                            router.push(`/dashboard/links/${shortUrl}/details`);
                          }
                        }}
                        disabled={creating}
                      >
                        {creating ? (
                          <>
                            <Loader2 className="animate-spin" />
                            {t("creating")}
                          </>
                        ) : (
                          <>{t("create-link")}</>
                        )}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              )}
              <Button
                onClick={handleDelete}
                disabled={isDeleting}
                variant={"outline"}
                className="w-full border-none! rounded-none! justify-start! shadow-none! "
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="animate-spin" /> {t("deleting")}
                  </>
                ) : (
                  <>
                    <Trash2 /> {t("delete")}
                  </>
                )}
              </Button>
              {plan != "pro" ? (
                <HoverCard>
                  <HoverCardTrigger asChild>
                    <Button
                      variant={"outline"}
                      className="w-full border-none! rounded-none! justify-start! shadow-none! relative text-muted-foreground"
                    >
                      <FileChartColumn /> {t("export-raw-scan-data")}
                      <LockIcon className="ml-auto" />
                    </Button>
                  </HoverCardTrigger>
                  <HoverCardContent asChild>
                    <div className="w-full max-w-[300px] p-2! px-3! rounded bg-primary text-primary-foreground flex flex-col gap-0 items-start text-xs cursor-help">
                      <p className="text-sm font-bold">
                        {t("unlock-csv-data")}
                      </p>
                      <p>
                        <Link
                          className="underline hover:cursor-pointer"
                          href={`/dashboard/subscription`}
                        >
                          {t("upgrade")}
                        </Link>{" "}
                        {t("to-export-all-time-scan-data")}
                      </p>
                    </div>
                  </HoverCardContent>
                </HoverCard>
              ) : (
                <Button
                  onClick={async () => {
                    toast.promise<{ success: boolean; url: string }>(
                      async () => {
                        const response = await generateCSV({
                          code: currentQrCode.qrCodeId,
                          type: "scan",
                        });
                        return response;
                      },
                      {
                        loading: t("preparing-download"),
                        success: (response) => {
                          if (response.success) {
                            const a = document.createElement("a");
                            a.href = response.url;
                            a.download = `${currentQrCode.qrCodeId}-scans-${format(Date.now(), "dd-MM-yyyy")}.csv`;
                            a.click();
                            return t("download-ready");
                          }
                          return t("download-error");
                        },
                        error: t("download-error"),
                      },
                    );
                  }}
                  variant={"outline"}
                  className="w-full border-none! rounded-none! justify-start! shadow-none! relative"
                >
                  <FileChartColumn /> {t("export-raw-scan-data")}
                </Button>
              )}
            </ScrollPopoverContent>
          </Popover>
          <Button asChild variant={"outline"} className="p-2! aspect-square!">
            <Link
              href={`/dashboard/qr-codes/${currentQrCode.qrCodeId}/edit/customize`}
            >
              <Palette />
            </Link>
          </Button>
          <Button asChild variant={"outline"} className="p-2! aspect-square!">
            <Link
              href={`/dashboard/qr-codes/${currentQrCode.qrCodeId}/edit/content`}
            >
              <Edit2 />
            </Link>
          </Button>
          <Button
            onClick={() => {
              styledCode?.download({
                name: `${currentQrCode.qrCodeId}`,
                extension: "png",
              });
            }}
            variant={"outline"}
            className="p-2! aspect-square!"
          >
            <Download />
          </Button>
        </div>
        <Separator className="sm:hidden block w-full my-4" />
        <div className="lg:text-base text-sm truncate font-semibold">
          {t("website")}
        </div>
        <div className="w-full flex flex-row justify-start items-center gap-1">
          <CornerDownRight className="w-4 h-4 shrink-0" />
          <Link
            href={currentQrCode.longUrl}
            className="lg:text-base text-sm hover:underline truncate"
          >
            {currentQrCode.longUrl}
          </Link>
        </div>
        <div className="w-full mt-4 flex flex-row sm:items-center items-end justify-between">
          <div className="w-full flex sm:flex-row flex-col sm:items-center items-start sm:gap-4 gap-2">
            <div className="flex flex-row items-center gap-1">
              <Calendar className="w-4 h-4" />
              <p className="sm:text-sm text-xs">
                {format(currentQrCode.date, "MMM dd, yyyy")}
              </p>
            </div>
            <div className="md:flex hidden flex-row items-center gap-1">
              <Tags className="w-4 h-4" />
              <div className="flex flex-row items-center gap-1">
                {currentQrCode.tags?.map((tag, indx) => {
                  if (indx > 3) {
                    return null;
                  }
                  return (
                    <Button
                      key={tag.id}
                      variant={"secondary"}
                      className={
                        "h-4 p-1! text-sm rounded-none! border border-transparent"
                      }
                    >
                      {tag.tagName}
                    </Button>
                  );
                })}
                {currentQrCode.tags && currentQrCode.tags.length > 4 && (
                  <p className="text-xs">
                    +{currentQrCode.tags.length - 4} {t("more")}
                  </p>
                )}
                <Popover open={tagOpen} onOpenChange={tagOpenChange}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="link"
                      role="combobox"
                      className="w-fit! justify-between text-primary text-sm gap-1! px-0! py-0! h-fit!"
                    >
                      <PlusCircle className="text-primary w-3! h-3!" />{" "}
                      {t("add-tag")}
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
                                const added = currentQrCode.tags?.some(
                                  (_tag) => _tag.id == tag.id,
                                );
                                if (added) {
                                  const { success } = await removeTagFromQRCode(
                                    currentQrCode.qrCodeId,
                                    tag.id,
                                  );
                                  if (success) {
                                    setCurrentQrCode((prev) => ({
                                      ...prev,
                                      tags:
                                        prev.tags?.filter(
                                          (_t) => _t.id != tag.id,
                                        ) || [],
                                    }));
                                    tagOpenChange(false);
                                  }
                                } else {
                                  const { success } = await addTagToQRCode(
                                    currentQrCode.qrCodeId,
                                    tag.id,
                                  );
                                  if (success) {
                                    setCurrentQrCode((prev) => ({
                                      ...prev,
                                      tags: [...(prev.tags || []), tag],
                                    }));
                                    tagOpenChange(false);
                                  }
                                }
                              }}
                            >
                              {tag.tagName}
                              <Check
                                className={cn(
                                  "ml-auto",
                                  currentQrCode.tags?.some(
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
                                const { success, tag } =
                                  await createAndAddTagToUrl(
                                    input,
                                    currentQrCode.qrCodeId,
                                  );
                                setInput("");
                                if (success && tag) {
                                  setCurrentQrCode((prev) => ({
                                    ...prev,
                                    tags: [...(prev.tags || []), tag],
                                  }));
                                }
                                tagOpenChange(false);
                              }}
                            >
                              {t("create-tag", { input })}
                            </CommandItem>
                          )}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </ScrollPopoverContent>
                </Popover>
              </div>
            </div>
            <div className="md:hidden flex flex-row items-center gap-1">
              <Tags className="w-4 h-4" />
              {currentQrCode.tags && currentQrCode.tags.length > 0 ? (
                <p className="text-xs">
                  {t("tag-count", { count: currentQrCode.tags.length })}
                </p>
              ) : (
                <p className="text-xs">{t("no-tags")}</p>
              )}
            </div>
          </div>
        </div>
      </div>
      <div className="w-full sm:mx-0 mx-auto shrink-0 max-w-28 h-auto aspect-square! p-2 border">
        <StyledQRCode
          options={currentQrCode.options}
          className="w-full h-auto aspect-square object-contain"
        />
      </div>
      <div className="fixed -top-[9999px] -left-[9999px] -z-99 pointer-events-none opacity-0 w-[1000px] h-[1000px]">
        <StyledQRCode
          setStyledCode={setStyledCode}
          options={currentQrCode.options}
          className="w-full h-auto aspect-square object-contain"
        />
      </div>
    </div>
  );
};
