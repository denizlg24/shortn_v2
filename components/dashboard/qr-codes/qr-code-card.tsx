import {
  addTagToQRCode,
  createAndAddTagToQRCode,
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
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { Popover, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { Link, useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { TQRCode } from "@/models/url/QRCodeV2";
import { ITag } from "@/models/url/Tag";
import { format } from "date-fns";
import {
  Calendar,
  ChartNoAxesColumn,
  Check,
  CornerDownRight,
  Download,
  Edit2,
  Ellipsis,
  LinkIcon,
  Loader2,
  LockIcon,
  Palette,
  PlusCircle,
  Tags,
  Trash2,
} from "lucide-react";
import { useState, useEffect, useCallback } from "react";
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
import { Skeleton } from "@/components/ui/skeleton";
import { createShortn } from "@/app/actions/linkActions";
import { attachShortnToQR, deleteQRCode } from "@/app/actions/qrCodeActions";
import { toast } from "sonner";
import { ScrollPopoverContent } from "@/components/ui/scroll-popover-content";
import { StyledQRCode } from "@/components/ui/styled-qr-code";
import QRCodeStyling from "qr-code-styling";
import { authClient } from "@/lib/authClient";
import { usePlan } from "@/hooks/use-plan";

export const QRCodeCard = ({
  qrCode,
  addTag,
  removeTag,
  tags,
  tagOptions: externalTagOptions,
  onTagSearchChange,
}: {
  qrCode: TQRCode;
  addTag: (tagId: string) => void;
  removeTag: (tagId: string) => void;
  tags: string[];
  tagOptions?: ITag[];
  onTagSearchChange?: (search: string) => void;
}) => {
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

  const linksLeft =
    plan != "pro"
      ? (usage?.links.limit ?? 0) - (usage?.links.consumed ?? 0)
      : undefined;

  const [currentQrCode, setCurrentQrCode] = useState(qrCode);
  const [input, setInput] = useState("");
  const [tagOpen, tagOpenChange] = useState(false);

  const tagOptions = externalTagOptions || [];

  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const hasExactMatch = tagOptions.some((tag) => tag.tagName === input);

  const shouldShowAddTag =
    input != "" && (!hasExactMatch || tagOptions.length === 0);

  const [styledCode, setStyledCode] = useState<QRCodeStyling | undefined>(
    undefined,
  );

  useEffect(() => {
    if (onTagSearchChange) {
      onTagSearchChange(input);
    }
  }, [input, onTagSearchChange]);

  const router = useRouter();

  if (!user) {
    return null;
  }

  return (
    <div className="lg:p-6 sm:p-4 p-3 rounded bg-background shadow flex flex-col">
      <div className="w-full flex md:flex-row flex-col items-center gap-4 justify-start">
        <div className="lg:min-w-24 md:min-w-20 w-full max-w-24 h-auto aspect-square">
          <StyledQRCode
            options={qrCode.options}
            className="w-full h-auto aspect-square object-contain"
          />
        </div>
        <div className="fixed -top-[9999px] -left-[9999px] -z-99 pointer-events-none opacity-0 w-[1000px] h-[1000px]">
          <StyledQRCode
            setStyledCode={setStyledCode}
            options={qrCode.options}
            className="w-full h-auto aspect-square object-contain"
          />
        </div>
        <div className="flex flex-col gap-0 lg:w-[calc(100%-96px-16px)] md:w-[calc(100%-80px-16px)] w-full">
          <div className="w-full max-w-full flex flex-row items-start justify-between gap-4">
            <Link
              href={`/dashboard/qr-codes/${currentQrCode.qrCodeId}/details`}
              className="font-bold lg:text-lg md:text-base text-sm hover:underline underline-offset-4 truncate "
            >
              {currentQrCode.title}
            </Link>
            <div className="lg:flex hidden flex-row items-center gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant={"outline"} className="p-2! aspect-square!">
                    <Ellipsis />
                  </Button>
                </PopoverTrigger>
                <ScrollPopoverContent
                  align="end"
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
                        <LinkIcon /> View short link
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
                          <LinkIcon /> Create short link
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle className="text-left!">
                            Create a link for your Code
                          </DialogTitle>
                          <DialogDescription asChild>
                            <div className="flex flex-row gap-1 w-full flex-wrap text-left!">
                              <p>
                                Creating a link for this QR Code will use up one
                                of your monthly links.
                              </p>
                              {linksLeft == undefined ? (
                                <div className="text-muted-foreground sm:text-sm text-xs w-full flex flex-row items-center gap-1 border-b border-dashed">
                                  <Skeleton className="w-3 h-3" />
                                  <p>left</p>
                                </div>
                              ) : linksLeft > 0 ? (
                                <p className="text-muted-foreground sm:text-sm text-xs gap-1 flex flex-row items-center border-b border-dashed">
                                  <span className="font-semibold">
                                    {linksLeft}
                                  </span>{" "}
                                  left
                                </p>
                              ) : (
                                <></>
                              )}
                            </div>
                          </DialogDescription>
                        </DialogHeader>
                        <div className="w-full flex flex-col text-left gap-1 items-start">
                          <p className="font-semibold xs:text-base text-sm">
                            Destination
                          </p>
                          <p className="xs:text-sm text-xs">{qrCode.longUrl}</p>
                        </div>
                        <div className="w-full flex flex-col text-left gap-1 items-start">
                          <p className="font-semibold xs:text-base text-sm">
                            Title
                          </p>
                          <p className="xs:text-sm text-xs">{qrCode.title}</p>
                        </div>
                        <DialogFooter className="flex flex-row items-center justify-end gap-2">
                          <DialogClose asChild>
                            <Button variant={"secondary"}>Cancel</Button>
                          </DialogClose>
                          <Button
                            onClick={async () => {
                              setCreating(true);
                              const response = await createShortn({
                                longUrl: qrCode.longUrl,
                                title: qrCode.title,
                                tags: qrCode.tags?.map((t) => t.id),
                                qrCodeId: qrCode.qrCodeId,
                              });
                              if (!response.success) {
                                switch (response.message) {
                                  case "no-user":
                                    setError("User session error.");
                                    setCreating(false);
                                    return;
                                  case "custom-restricted":
                                    setError(
                                      "Custom back-halves are restricted to pro accounts.",
                                    );
                                    setCreating(false);
                                    return;
                                  case "plan-limit":
                                    setError(
                                      "You have reached your plan's link limit.",
                                    );
                                    setCreating(false);
                                    return;
                                  default:
                                    setError(
                                      "There was a problem creating your link.",
                                    );
                                    setCreating(false);
                                    return;
                                }
                              }
                              if (response.success && response.data) {
                                const shortUrl = response.data.shortUrl;

                                await attachShortnToQR(
                                  shortUrl,
                                  qrCode.qrCodeId,
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
                                Creating...
                              </>
                            ) : (
                              <>Create link</>
                            )}
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  )}
                  <Button
                    onClick={async () => {
                      const response = await deleteQRCode(qrCode.qrCodeId);
                      if (response.success) {
                        toast.success(
                          `QR Code ${qrCode.qrCodeId} was successfully deleted.`,
                        );
                      } else {
                        toast.error(
                          "There was a problem deleting your QR Code.",
                        );
                      }
                      router.refresh();
                    }}
                    variant={"outline"}
                    className="w-full border-none! rounded-none! justify-start! shadow-none! "
                  >
                    <Trash2 /> Delete
                  </Button>
                </ScrollPopoverContent>
              </Popover>
              <Button
                asChild
                variant={"outline"}
                className="p-2! aspect-square!"
              >
                <Link
                  href={`/dashboard/qr-codes/${currentQrCode.qrCodeId}/edit/customize`}
                >
                  <Palette />
                </Link>
              </Button>
              <Button
                asChild
                variant={"outline"}
                className="p-2! aspect-square!"
              >
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
              <Button variant={"secondary"} asChild>
                <Link
                  href={`/dashboard/qr-codes/${currentQrCode.qrCodeId}/details`}
                >
                  <ChartNoAxesColumn />
                  View Details
                </Link>
              </Button>
            </div>
          </div>
          <div className="lg:text-base text-sm truncate font-semibold lg:-mt-4">
            Website
          </div>
          <div className="w-full flex flex-row justify-start items-center gap-1">
            <CornerDownRight className="w-4 h-4 shrink-0" />
            <Link
              href={currentQrCode.longUrl}
              className="lg:text-base md:text-sm text-xs hover:underline truncate"
            >
              {currentQrCode.longUrl}
            </Link>
          </div>
          <div className="w-full mt-4 flex flex-row sm:items-center items-end justify-between">
            <div className="w-full flex sm:flex-row flex-col sm:items-center items-start sm:gap-4 gap-2">
              <div className="flex flex-row items-center gap-1">
                <ChartNoAxesColumn className="w-4 h-4" />
                {plan == "free" ? (
                  <HoverCard>
                    <HoverCardTrigger
                      className="px-1 rounded-none! h-fit text-xs flex flex-row bg-secondary items-center py-0.5 shadow-xs font-normal
                  gap-1! hover:cursor-help"
                    >
                      <LockIcon className="w-3! h-3!" />
                      Scan Data
                    </HoverCardTrigger>
                    <HoverCardContent asChild>
                      <div className="w-full max-w-[300px] p-2! px-3! rounded bg-primary text-primary-foreground flex flex-col gap-0 items-start text-xs cursor-help">
                        <p className="text-sm font-bold">Unlock scan data</p>
                        <div className="w-full flex flex-row gap-1 items-center">
                          <Link
                            href={`/dashboard/subscription`}
                            className="underline hover:cursor-pointer"
                          >
                            Upgrade
                          </Link>
                          <p>to access QR Code stats.</p>
                        </div>
                      </div>
                    </HoverCardContent>
                  </HoverCard>
                ) : (
                  <p className="p-0! px-1! rounded-none! h-fit text-xs font-normal gap-1!">
                    {currentQrCode.clicks.total}
                    {currentQrCode.clicks.total == 1 ? " scan" : " scans"}
                  </p>
                )}
              </div>
              <div className="flex flex-row items-center gap-1">
                <Calendar className="w-4 h-4" />
                <p className="sm:text-sm text-xs">
                  {format(currentQrCode.date, "MMM dd, yyyy")}
                </p>
              </div>
              <div className="lg:flex hidden flex-row items-center gap-1">
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
                        onClick={() => {
                          const added = tags.some((t) => t == tag.id);
                          if (added) {
                            removeTag(tag.id);
                          } else {
                            addTag(tag.id);
                          }
                        }}
                        className={cn(
                          "h-4 p-1! text-sm rounded-none! hover:cursor-pointer border border-transparent hover:border-primary",
                          tags.some((t) => t == tag.id) && "border-primary",
                        )}
                      >
                        {tag.tagName}
                      </Button>
                    );
                  })}
                  {currentQrCode.tags && currentQrCode.tags.length > 4 && (
                    <p className="text-xs">
                      +{currentQrCode.tags.length - 4} more
                    </p>
                  )}
                  <Popover open={tagOpen} onOpenChange={tagOpenChange}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="link"
                        role="combobox"
                        className="w-fit! justify-between text-primary text-sm gap-1! px-0! py-0! h-fit!"
                      >
                        <PlusCircle className="text-primary w-3! h-3!" /> Add
                        tag
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
                          placeholder="Search tags..."
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
                                    const { success } =
                                      await removeTagFromQRCode(
                                        currentQrCode.qrCodeId,
                                        tag.id,
                                      );
                                    if (success) {
                                      setCurrentQrCode((prev) => ({
                                        ...prev,
                                        tags: prev.tags?.filter(
                                          (_t) =>
                                            (_t._id as string).toString() !=
                                            (tag._id as string).toString(),
                                        ),
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
                                    await createAndAddTagToQRCode(
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
                                Create &quot;{input}&quot;
                              </CommandItem>
                            )}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </ScrollPopoverContent>
                  </Popover>
                </div>
              </div>
              <div className="lg:hidden flex flex-row items-center gap-1">
                <Tags className="w-4 h-4" />
                {currentQrCode.tags && currentQrCode.tags.length > 0 ? (
                  <p className="text-xs">
                    {currentQrCode.tags.length}{" "}
                    {currentQrCode.tags.length == 1 ? "tag" : "tags"}
                  </p>
                ) : (
                  <p className="text-xs">No tags</p>
                )}
              </div>
            </div>
          </div>
          <Separator className="md:hidden block w-full my-4" />
          <div className="md:hidden flex flex-row items-center justify-start gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant={"outline"}
                  className="p-1.5! h-fit! aspect-square!"
                >
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
                      <LinkIcon /> View short link
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
                        <LinkIcon /> Create short link
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle className="text-left!">
                          Create a link for your Code
                        </DialogTitle>
                        <DialogDescription asChild>
                          <div className="flex flex-row gap-1 w-full flex-wrap text-left!">
                            <p>
                              Creating a link for this QR Code will use up one
                              of your monthly links.
                            </p>
                            {linksLeft == undefined ? (
                              <div className="text-muted-foreground sm:text-sm text-xs w-full flex flex-row items-center gap-1 border-b border-dashed">
                                <Skeleton className="w-3 h-3" />
                                <p>left</p>
                              </div>
                            ) : linksLeft > 0 ? (
                              <p className="text-muted-foreground sm:text-sm text-xs gap-1 flex flex-row items-center border-b border-dashed">
                                <span className="font-semibold">
                                  {linksLeft}
                                </span>{" "}
                                left
                              </p>
                            ) : (
                              <></>
                            )}
                          </div>
                        </DialogDescription>
                      </DialogHeader>
                      <div className="w-full flex flex-col text-left gap-1 items-start">
                        <p className="font-semibold xs:text-base text-sm">
                          Destination
                        </p>
                        <p className="xs:text-sm text-xs">{qrCode.longUrl}</p>
                      </div>
                      <div className="w-full flex flex-col text-left gap-1 items-start">
                        <p className="font-semibold xs:text-base text-sm">
                          Title
                        </p>
                        <p className="xs:text-sm text-xs">{qrCode.title}</p>
                      </div>
                      {error && (
                        <p className="xs:text-sm text-xs text-destructive">
                          {error}
                        </p>
                      )}
                      <DialogFooter className="flex flex-row items-center justify-end gap-2">
                        <DialogClose asChild>
                          <Button variant={"secondary"}>Cancel</Button>
                        </DialogClose>
                        <Button
                          onClick={async () => {
                            setCreating(true);
                            const response = await createShortn({
                              longUrl: qrCode.longUrl,
                              title: qrCode.title,
                              tags: qrCode.tags?.map((t) => t.id),
                              qrCodeId: qrCode.qrCodeId,
                            });
                            if (!response.success) {
                              switch (response.message) {
                                case "no-user":
                                  setError("User session error.");
                                  setCreating(false);
                                  return;
                                case "custom-restricted":
                                  setError(
                                    "Custom back-halves are restricted to pro accounts.",
                                  );
                                  setCreating(false);
                                  return;
                                case "plan-limit":
                                  setError(
                                    "You have reached your plan's link limit.",
                                  );
                                  setCreating(false);
                                  return;
                                default:
                                  setError(
                                    "There was a problem creating your link.",
                                  );
                                  setCreating(false);
                                  return;
                              }
                            }
                            if (response.success && response.data) {
                              const shortUrl = response.data.shortUrl;

                              await attachShortnToQR(shortUrl, qrCode.qrCodeId);
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
                              Creating...
                            </>
                          ) : (
                            <>Create link</>
                          )}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                )}
                <Button
                  onClick={async () => {
                    const response = await deleteQRCode(qrCode.qrCodeId);
                    if (response.success) {
                      toast.success(
                        `QR Code ${qrCode.qrCodeId} was successfully deleted.`,
                      );
                    } else {
                      toast.error("There was a problem deleting your QR Code.");
                    }
                    router.refresh();
                  }}
                  variant={"outline"}
                  className="w-full border-none! rounded-none! justify-start! shadow-none! "
                >
                  <Trash2 /> Delete
                </Button>
              </ScrollPopoverContent>
            </Popover>
            <Button
              asChild
              variant={"outline"}
              className="p-1.5! h-fit! aspect-square!"
            >
              <Link
                href={`/dashboard/qr-codes/${currentQrCode.qrCodeId}/edit/customize`}
              >
                <Palette />
              </Link>
            </Button>
            <Button
              asChild
              variant={"outline"}
              className="p-1.5! h-fit! aspect-square!"
            >
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
              className="p-1.5! h-fit! aspect-square!"
            >
              <Download />
            </Button>
            <Button variant={"secondary"} className="p-1.5! h-fit!" asChild>
              <Link
                href={`/dashboard/qr-codes/${currentQrCode.qrCodeId}/details`}
              >
                <ChartNoAxesColumn />
                View Details
              </Link>
            </Button>
          </div>
        </div>
      </div>
      <Separator className="lg:hidden md:block hidden w-full my-4" />
      <div className="lg:hidden md:flex hidden flex-row items-center justify-start gap-2">
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant={"outline"}
              className="p-1.5! h-fit! aspect-square!"
            >
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
                  <LinkIcon /> View short link
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
                    <LinkIcon /> Create short link
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle className="text-left!">
                      Create a link for your Code
                    </DialogTitle>
                    <DialogDescription asChild>
                      <div className="flex flex-row gap-1 w-full flex-wrap text-left!">
                        <p>
                          Creating a link for this QR Code will use up one of
                          your monthly links.
                        </p>
                        {linksLeft == undefined ? (
                          <div className="text-muted-foreground sm:text-sm text-xs w-full flex flex-row items-center gap-1 border-b border-dashed">
                            <Skeleton className="w-3 h-3" />
                            <p>left</p>
                          </div>
                        ) : linksLeft > 0 ? (
                          <p className="text-muted-foreground sm:text-sm text-xs gap-1 flex flex-row items-center border-b border-dashed">
                            <span className="font-semibold">{linksLeft}</span>{" "}
                            left
                          </p>
                        ) : (
                          <></>
                        )}
                      </div>
                    </DialogDescription>
                  </DialogHeader>
                  <div className="w-full flex flex-col text-left gap-1 items-start">
                    <p className="font-semibold xs:text-base text-sm">
                      Destination
                    </p>
                    <p className="xs:text-sm text-xs">{qrCode.longUrl}</p>
                  </div>
                  <div className="w-full flex flex-col text-left gap-1 items-start">
                    <p className="font-semibold xs:text-base text-sm">Title</p>
                    <p className="xs:text-sm text-xs">{qrCode.title}</p>
                  </div>
                  {error && (
                    <p className="xs:text-sm text-xs text-destructive">
                      {error}
                    </p>
                  )}
                  <DialogFooter className="flex flex-row items-center justify-end gap-2">
                    <DialogClose asChild>
                      <Button variant={"secondary"}>Cancel</Button>
                    </DialogClose>
                    <Button
                      onClick={async () => {
                        setCreating(true);
                        const response = await createShortn({
                          longUrl: qrCode.longUrl,
                          title: qrCode.title,
                          tags: qrCode.tags?.map((t) => t.id),
                          qrCodeId: qrCode.qrCodeId,
                        });
                        if (!response.success) {
                          switch (response.message) {
                            case "no-user":
                              setError("User session error.");
                              setCreating(false);
                              return;
                            case "custom-restricted":
                              setError(
                                "Custom back-halves are restricted to pro accounts.",
                              );
                              setCreating(false);
                              return;
                            case "plan-limit":
                              setError(
                                "You have reached your plan's link limit.",
                              );
                              setCreating(false);
                              return;
                            default:
                              setError(
                                "There was a problem creating your link.",
                              );
                              setCreating(false);
                              return;
                          }
                        }
                        if (response.success && response.data) {
                          const shortUrl = response.data.shortUrl;
                          await attachShortnToQR(shortUrl, qrCode.qrCodeId);
                          router.push(`/dashboard/links/${shortUrl}/details`);
                        }
                      }}
                    >
                      {creating ? (
                        <>
                          <Loader2 className="animate-spin" />
                          Creating...
                        </>
                      ) : (
                        <>Create link</>
                      )}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
            <Button
              onClick={async () => {
                const response = await deleteQRCode(qrCode.qrCodeId);
                if (response.success) {
                  toast.success(
                    `QR Code ${qrCode.qrCodeId} was successfully deleted.`,
                  );
                } else {
                  toast.error("There was a problem deleting your QR Code.");
                }
                router.refresh();
              }}
              variant={"outline"}
              className="w-full border-none! rounded-none! justify-start! shadow-none! "
            >
              <Trash2 /> Delete
            </Button>
          </ScrollPopoverContent>
        </Popover>
        <Button
          asChild
          variant={"outline"}
          className="p-1.5! h-fit! aspect-square!"
        >
          <Link
            href={`/dashboard/qr-codes/${currentQrCode.qrCodeId}/edit/customize`}
          >
            <Palette />
          </Link>
        </Button>
        <Button
          asChild
          variant={"outline"}
          className="p-1.5! h-fit! aspect-square!"
        >
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
          className="p-1.5! h-fit! aspect-square!"
        >
          <Download />
        </Button>
        <Button variant={"secondary"} className="p-1.5! h-fit!" asChild>
          <Link href={`/dashboard/qr-codes/${currentQrCode.qrCodeId}/details`}>
            <ChartNoAxesColumn />
            View Details
          </Link>
        </Button>
      </div>
    </div>
  );
};
