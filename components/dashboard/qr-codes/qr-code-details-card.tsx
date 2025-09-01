"use client";
import { createShortn } from "@/app/actions/linkActions";
import { attachShortnToQR, deleteQRCode } from "@/app/actions/qrCodeActions";
import {
  addTagToQRCode,
  createAndAddTagToUrl,
  removeTagFromQRCode,
} from "@/app/actions/tagActions";
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
import { IQRCode } from "@/models/url/QRCodeV2";
import { ITag } from "@/models/url/Tag";
import { useUser } from "@/utils/UserContext";
import { format } from "date-fns";
import {
  Calendar,
  Check,
  CornerDownRight,
  Download,
  Edit2,
  Ellipsis,
  LinkIcon,
  Loader2,
  Palette,
  PlusCircle,
  Tags,
  Trash2,
} from "lucide-react";
import Image from "next/image";
import { useState, useEffect } from "react";
import { getLinksLeft } from "../home/quick-create";
import { toast } from "sonner";

export const QRCodeDetailsCard = ({ qrCode }: { qrCode: IQRCode }) => {
  const session = useUser();
  const [input, setInput] = useState("");
  const [tagOptions, setTagOptions] = useState<ITag[]>([]);
  const [notFound, setNotFound] = useState(false);
  const [tagOpen, tagOpenChange] = useState(false);
  const [shouldShowAddTag, setExactTagMatch] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  const handleDownload = (base64: string, filename: string) => {
    const link = document.createElement("a");
    link.href = base64;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  useEffect(() => {
    if (!session.user) {
      return;
    }

    const delayDebounce = setTimeout(() => {
      if (input.trim() === "") {
        fetchApi<{ tags: ITag[] }>("tags").then((res) => {
          if (res.success) {
            setTagOptions(res.tags);
            setNotFound(false);
          } else {
            setTagOptions([]);
            setNotFound(true);
          }
        });
        return;
      }
      fetchApi<{ tags: ITag[] }>(`tags?q=${input}`).then((res) => {
        if (res.success) {
          setTagOptions(res.tags);
          setNotFound(res.tags.length === 0);
        } else {
          setTagOptions([]);
          setNotFound(true);
        }
      });
    }, 300);

    return () => clearTimeout(delayDebounce);
  }, [input, session.user]);

  useEffect(() => {
    const hasExactMatch = tagOptions.some((tag) => tag.tagName === input);

    const _shouldShowAddTag =
      input != "" && (!hasExactMatch || tagOptions.length === 0);

    setExactTagMatch(_shouldShowAddTag);
  }, [tagOptions, notFound, input]);

  const router = useRouter();

  if (!session) {
    return <Skeleton className="w-full h-42 bg-background" />;
  }
  if (!session.user) {
    return <Skeleton className="w-full h-42 bg-background" />;
  }

  return (
    <div className="lg:p-6 sm:p-4 p-3 pt-6 rounded bg-background shadow w-full flex sm:flex-row flex-col-reverse items-start gap-4 justify-between">
      <div className="w-full grow sm:max-w-[calc(100%-112px-8px-8px)] flex flex-col gap-0">
        <div className="w-full flex flex-row items-start sm:justify-between gap-2 justify-center">
          <h1 className="font-bold lg:text-2xl md:text-xl text-lg truncate">
            {qrCode.title}
          </h1>
          <div className="sm:flex hidden flex-row items-center gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant={"outline"} className="p-2! aspect-square!">
                  <Ellipsis />
                </Button>
              </PopoverTrigger>
              <ScrollPopoverContent className="w-[200px] flex flex-col px-0! py-1 gap-1">
                {qrCode.attachedUrl ? (
                  <Button
                    asChild
                    variant={"outline"}
                    className="w-full border-none! rounded-none! justify-start! shadow-none! "
                  >
                    <Link
                      href={`/dashboard/links/${qrCode.attachedUrl}/details`}
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
                            {getLinksLeft(
                              session.user.plan.subscription,
                              session.user.qr_codes_this_month,
                              true
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
                                    "Custom back-halves are restricted to pro accounts."
                                  );
                                  setCreating(false);
                                  return;
                                case "plan-limit":
                                  setError(
                                    "You have reached your plan's link limit."
                                  );
                                  setCreating(false);
                                  return;
                                default:
                                  setError(
                                    "There was a problem creating your link."
                                  );
                                  setCreating(false);
                                  return;
                              }
                            }
                            if (response.success && response.data) {
                              await attachShortnToQR(
                                response.data.shortUrl,
                                qrCode.qrCodeId
                              );
                              router.push(
                                `/dashboard/links/${response.data.shortUrl}/details`
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
                  onClick={async () => {
                    const response = await deleteQRCode(qrCode.qrCodeId);
                    if (response.success) {
                      toast.success(
                        `QR Code ${qrCode.qrCodeId} was successfully deleted.`
                      );
                    } else {
                      toast.error("There was a problem deleting your QR Code.");
                    }
                    router.push("/dashboard/qr-codes");
                  }}
                  variant={"outline"}
                  className="w-full border-none! rounded-none! justify-start! shadow-none! "
                >
                  <Trash2 /> Delete
                </Button>
              </ScrollPopoverContent>
            </Popover>
            <Button asChild variant={"outline"} className="p-2! aspect-square!">
              <Link
                href={`/dashboard/qr-codes/${qrCode.qrCodeId}/edit/customize`}
              >
                <Palette />
              </Link>
            </Button>
            <Button asChild variant={"outline"} className="p-2! aspect-square!">
              <Link
                href={`/dashboard/qr-codes/${qrCode.qrCodeId}/edit/content`}
              >
                <Edit2 />
              </Link>
            </Button>
            <Button
              onClick={() => {
                handleDownload(qrCode.qrCodeBase64, `${qrCode.qrCodeId}.png`);
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
            <ScrollPopoverContent className="w-[200px] flex flex-col px-0! py-1 gap-1">
              {qrCode.attachedUrl ? (
                <Button
                  asChild
                  variant={"outline"}
                  className="w-full border-none! rounded-none! justify-start! shadow-none! "
                >
                  <Link href={`/dashboard/links/${qrCode.attachedUrl}/details`}>
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
                          {getLinksLeft(
                            session.user.plan.subscription,
                            session.user.qr_codes_this_month,
                            true
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
                                  "Custom back-halves are restricted to pro accounts."
                                );
                                setCreating(false);
                                return;
                              case "plan-limit":
                                setError(
                                  "You have reached your plan's link limit."
                                );
                                setCreating(false);
                                return;
                              default:
                                setError(
                                  "There was a problem creating your link."
                                );
                                setCreating(false);
                                return;
                            }
                          }
                          if (response.success && response.data) {
                            await attachShortnToQR(
                              response.data.shortUrl,
                              qrCode.qrCodeId
                            );
                            router.push(
                              `/dashboard/links/${response.data.shortUrl}/details`
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
                      `QR Code ${qrCode.qrCodeId} was successfully deleted.`
                    );
                  } else {
                    toast.error("There was a problem deleting your QR Code.");
                  }
                  router.push("/dashboard/qr-codes");
                }}
                variant={"outline"}
                className="w-full border-none! rounded-none! justify-start! shadow-none! "
              >
                <Trash2 /> Delete
              </Button>
            </ScrollPopoverContent>
          </Popover>
          <Button asChild variant={"outline"} className="p-2! aspect-square!">
            <Link
              href={`/dashboard/qr-codes/${qrCode.qrCodeId}/edit/customize`}
            >
              <Palette />
            </Link>
          </Button>
          <Button asChild variant={"outline"} className="p-2! aspect-square!">
            <Link href={`/dashboard/qr-codes/${qrCode.qrCodeId}/edit/content`}>
              <Edit2 />
            </Link>
          </Button>
          <Button
            onClick={() => {
              handleDownload(qrCode.qrCodeBase64, `${qrCode.qrCodeId}.png`);
            }}
            variant={"outline"}
            className="p-2! aspect-square!"
          >
            <Download />
          </Button>
        </div>
        <Separator className="sm:hidden block w-full my-4" />
        <div className="lg:text-base text-sm truncate font-semibold">
          Website
        </div>
        <div className="w-full flex flex-row justify-start items-center gap-1">
          <CornerDownRight className="w-4 h-4 shrink-0" />
          <Link
            href={qrCode.longUrl}
            className="lg:text-base text-sm hover:underline truncate"
          >
            {qrCode.longUrl}
          </Link>
        </div>
        <div className="w-full mt-4 flex flex-row sm:items-center items-end justify-between">
          <div className="w-full flex sm:flex-row flex-col sm:items-center items-start sm:gap-4 gap-2">
            <div className="flex flex-row items-center gap-1">
              <Calendar className="w-4 h-4" />
              <p className="sm:text-sm text-xs">
                {format(qrCode.date, "MMM dd, yyyy")}
              </p>
            </div>
            <div className="md:flex hidden flex-row items-center gap-1">
              <Tags className="w-4 h-4" />
              <div className="flex flex-row items-center gap-1">
                {qrCode.tags?.map((tag, indx) => {
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
                {qrCode.tags && qrCode.tags.length > 4 && (
                  <p className="text-xs">+{qrCode.tags.length - 4} more</p>
                )}
                <Popover open={tagOpen} onOpenChange={tagOpenChange}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="link"
                      role="combobox"
                      className="w-fit! justify-between text-primary text-sm gap-1! px-0! py-0! h-fit!"
                    >
                      <PlusCircle className="text-primary w-3! h-3!" /> Add tag
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
                                const added = qrCode.tags?.some(
                                  (_tag) => _tag.id == tag.id
                                );
                                if (added) {
                                  const { success } = await removeTagFromQRCode(
                                    qrCode.qrCodeId,
                                    tag.id
                                  );
                                  if (success) {
                                    qrCode.tags =
                                      qrCode.tags?.filter(
                                        (_t) => _t.id != tag.id
                                      ) || [];
                                    tagOpenChange(false);
                                  }
                                } else {
                                  const { success } = await addTagToQRCode(
                                    qrCode.qrCodeId,
                                    tag.id
                                  );
                                  if (success) {
                                    qrCode.tags?.push(tag);
                                    tagOpenChange(false);
                                  }
                                }
                              }}
                            >
                              {tag.tagName}
                              <Check
                                className={cn(
                                  "ml-auto",
                                  qrCode.tags?.some(
                                    (_tag) => _tag.tagName == tag.tagName
                                  )
                                    ? "opacity-100"
                                    : "opacity-0"
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
                                    qrCode.qrCodeId
                                  );
                                setInput("");
                                if (success && tag) {
                                  qrCode.tags?.push(tag);
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
            <div className="md:hidden flex flex-row items-center gap-1">
              <Tags className="w-4 h-4" />
              {qrCode.tags && qrCode.tags.length > 0 ? (
                <p className="text-xs">
                  {qrCode.tags.length}{" "}
                  {qrCode.tags.length == 1 ? "tag" : "tags"}
                </p>
              ) : (
                <p className="text-xs">No tags</p>
              )}
            </div>
          </div>
        </div>
      </div>
      <div className="w-full sm:mx-0 mx-auto shrink-0 max-w-28 h-auto aspect-square! p-2 border">
        <Image
          src={qrCode.qrCodeBase64}
          alt="QR Code"
          width={1080}
          height={1080}
          className="w-full h-auto aspect-square object-contain"
        />
      </div>
    </div>
  );
};
