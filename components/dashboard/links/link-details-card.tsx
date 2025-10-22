"use client";
import { deleteShortn, generateCSV } from "@/app/actions/linkActions";
import {
  addTagToLink,
  createAndAddTagToUrl,
  removeTagFromLink,
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
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";

import { Input } from "@/components/ui/input";
import { Popover, PopoverTrigger } from "@/components/ui/popover";
import { ScrollPopoverContent } from "@/components/ui/scroll-popover-content";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Link, useRouter } from "@/i18n/navigation";
import { cn, fetchApi } from "@/lib/utils";
import { ITag } from "@/models/url/Tag";
import { IUrl } from "@/models/url/UrlV3";
import { useUser } from "@/utils/UserContext";
import { format } from "date-fns";

import {
  Calendar,
  Check,
  Copy,
  CopyCheck,
  Edit2,
  Ellipsis,
  FileChartColumn,
  LockIcon,
  PlusCircle,
  Share2,
  Tags,
  Trash2,
} from "lucide-react";
import {
  FacebookShareButton,
  RedditShareButton,
  RedditIcon,
  TwitterShareButton,
  WhatsappShareButton,
  WhatsappIcon,
  EmailShareButton,
  EmailIcon,
  FacebookIcon,
  TwitterIcon,
} from "next-share";
import { useState, useEffect } from "react";
import { toast } from "sonner";

export const LinkDetailsCard = ({ currentLink }: { currentLink: IUrl }) => {
  const session = useUser();
  const [input, setInput] = useState("");
  const [tagOptions, setTagOptions] = useState<ITag[]>([]);
  const [notFound, setNotFound] = useState(false);
  const [tagOpen, tagOpenChange] = useState(false);
  const [shouldShowAddTag, setExactTagMatch] = useState(true);

  //action
  const [justCopied, setJustCopied] = useState(false);

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

  if (notFound || !currentLink) {
    return <div>notFound</div>;
  }

  return (
    <div className="lg:p-6 sm:p-4 p-3 rounded bg-background shadow w-full flex flex-col gap-0">
      <div className="w-full flex flex-row items-start justify-between">
        <h1 className="font-bold lg:text-2xl md:text-xl text-lg truncate">
          {currentLink.title}
        </h1>
        <div className="md:flex hidden flex-row items-center gap-2">
          <Button
            onClick={async () => {
              await navigator.clipboard.writeText(currentLink.shortUrl);
              setJustCopied(true);
              setTimeout(() => {
                setJustCopied(false);
              }, 1000);
            }}
            variant={"secondary"}
          >
            {justCopied ? (
              <>
                <CopyCheck />
                Copied
              </>
            ) : (
              <>
                <Copy />
                Copy
              </>
            )}
          </Button>
          <Dialog>
            <DialogTrigger asChild>
              <Button variant={"outline"}>
                <Share2 />
                Share
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Share your Shortn Link</DialogTitle>
                <DialogDescription>
                  Share your link across social media.
                </DialogDescription>
              </DialogHeader>
              <div className="w-full grid grid-cols-5 gap-4">
                <FacebookShareButton
                  url={currentLink.shortUrl}
                  quote={"Check out this link shortened with Shortn.at"}
                >
                  <div className="col-span-1 w-full h-auto aspect-square border rounded flex items-center justify-center p-1 max-w-16 mx-auto">
                    <FacebookIcon size={32} round />
                  </div>
                </FacebookShareButton>
                <RedditShareButton
                  url={currentLink.shortUrl}
                  title={"Check out this link shortened with Shortn.at"}
                >
                  <div className="col-span-1 w-full h-auto aspect-square border rounded flex items-center justify-center p-1 max-w-16 mx-auto">
                    <RedditIcon size={32} round />
                  </div>
                </RedditShareButton>
                <TwitterShareButton
                  url={currentLink.shortUrl}
                  title={"Check out this link shortened with Shortn.at"}
                >
                  <div className="col-span-1 w-full h-auto aspect-square border rounded flex items-center justify-center p-1 max-w-16 mx-auto">
                    <TwitterIcon size={32} round />
                  </div>
                </TwitterShareButton>
                <WhatsappShareButton
                  url={currentLink.shortUrl}
                  title={"Check out this link shortened with Shortn.at"}
                  separator=" "
                >
                  <div className="col-span-1 w-full h-auto aspect-square border rounded flex items-center justify-center p-1 max-w-16 mx-auto">
                    <WhatsappIcon size={32} round />
                  </div>
                </WhatsappShareButton>
                <EmailShareButton
                  url={currentLink.shortUrl}
                  subject="Checkout my Shortn.at Link!"
                  body="Checkout this link shortened with Shortn.at"
                >
                  <div className="col-span-1 w-full h-auto aspect-square border rounded flex items-center justify-center p-1 max-w-16 mx-auto">
                    <EmailIcon size={32} round />
                  </div>
                </EmailShareButton>
              </div>
              <Separator />
              <div className="relative w-full flex items-center">
                <Input
                  value={currentLink.shortUrl}
                  readOnly
                  className="w-full bg-background"
                />
                <Button
                  onClick={async () => {
                    await navigator.clipboard.writeText(currentLink.shortUrl);
                    setJustCopied(true);
                    setTimeout(() => {
                      setJustCopied(false);
                    }, 1000);
                  }}
                  variant={"secondary"}
                  className="h-fit! py-1! px-2 text-xs font-bold z-10 hover:cursor-pointer absolute right-2"
                >
                  {justCopied ? <>Copied</> : <>Copy</>}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          <Button asChild variant={"outline"} className="p-2! aspect-square!">
            <Link href={`/dashboard/links/${currentLink.urlCode}/edit`}>
              <Edit2 />
            </Link>
          </Button>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant={"outline"} className="p-2! aspect-square!">
                <Ellipsis />
              </Button>
            </PopoverTrigger>
            <ScrollPopoverContent className="w-[200px] flex flex-col px-0! py-1 gap-1">
              <Button
                onClick={async () => {
                  const response = await deleteShortn(currentLink.urlCode);
                  if (response.success) {
                    toast.success(
                      `Link ${currentLink.urlCode} was successfully deleted.`,
                    );
                  } else {
                    toast.error("There was a problem deleting your link.");
                  }
                  router.push(`/dashboard/links`);
                }}
                variant={"outline"}
                className="w-full border-none! rounded-none! justify-start! shadow-none! "
              >
                <Trash2 /> Delete
              </Button>
              {session.user.plan.subscription != "pro" ? (
                <HoverCard>
                  <HoverCardTrigger asChild>
                    <Button
                      variant={"outline"}
                      className="w-full border-none! rounded-none! justify-start! shadow-none! relative text-muted-foreground"
                    >
                      <FileChartColumn /> Export full click data{" "}
                      <LockIcon className="ml-auto" />
                    </Button>
                  </HoverCardTrigger>
                  <HoverCardContent asChild>
                    <div className="w-full max-w-[300px] p-2! px-3! rounded bg-primary text-primary-foreground flex flex-col gap-0 items-start text-xs cursor-help">
                      <p className="text-sm font-bold">Unlock CSV data.</p>
                      <p>
                        <Link
                          className="underline hover:cursor-pointer"
                          href={`/dashboard/subscription`}
                        >
                          Upgrade
                        </Link>{" "}
                        to export all-time click data.
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
                          code: currentLink.urlCode,
                          type: "click",
                          filename: `${currentLink.urlCode}-clicks-${format(Date.now(), "dd-MM-yyyy")}`,
                        });
                        return response;
                      },
                      {
                        loading: "Preparing your download...",
                        success: (response) => {
                          if (response.success) {
                            const a = document.createElement("a");
                            a.href = response.url;
                            a.download = `${currentLink.urlCode}-clicks.csv`;
                            a.click();
                            return `Your download is ready and should start now.`;
                          }
                          return "There was an error creating your download.";
                        },
                        error: "There was an error creating your download.",
                      },
                    );
                  }}
                  variant={"outline"}
                  className="w-full border-none! rounded-none! justify-start! shadow-none! relative"
                >
                  <FileChartColumn /> Export full click data
                </Button>
              )}
            </ScrollPopoverContent>
          </Popover>
        </div>
      </div>
      <div className="w-full flex flex-row justify-start">
        <Link
          href={currentLink.shortUrl}
          prefetch={false}
          target="_blank"
          className="font-semibold lg:text-base text-sm hover:underline text-blue-500 truncate"
        >
          {currentLink.shortUrl.split("://")[1]}
        </Link>
      </div>
      <div className="w-full flex flex-row justify-start">
        <Link
          href={currentLink.longUrl}
          className="lg:text-base text-sm hover:underline truncate"
        >
          {currentLink.longUrl}
        </Link>
      </div>
      <div className="w-full mt-4 flex flex-row sm:items-center items-end justify-between">
        <div className="w-full flex sm:flex-row flex-col sm:items-center items-start sm:gap-4 gap-2">
          <div className="flex flex-row items-center gap-1">
            <Calendar className="w-4 h-4" />
            <p className="sm:text-sm text-xs">
              {format(currentLink.date, "MMM dd, yyyy")}
            </p>
          </div>
          <div className="md:flex hidden flex-row items-center gap-1">
            <Tags className="w-4 h-4" />
            <div className="flex flex-row items-center gap-1">
              {currentLink.tags?.map((tag, indx) => {
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
              {currentLink.tags && currentLink.tags.length > 4 && (
                <p className="text-xs">+{currentLink.tags.length - 4} more</p>
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
                              const added = currentLink.tags?.some(
                                (_tag) => _tag.id == tag.id,
                              );
                              if (added) {
                                const { success } = await removeTagFromLink(
                                  currentLink.urlCode,
                                  tag.id,
                                );
                                if (success) {
                                  currentLink.tags =
                                    currentLink.tags?.filter(
                                      (_t) => _t.id != tag.id,
                                    ) || [];
                                  tagOpenChange(false);
                                }
                              } else {
                                const { success } = await addTagToLink(
                                  currentLink.urlCode,
                                  tag.id,
                                );
                                if (success) {
                                  currentLink.tags?.push(tag);
                                  tagOpenChange(false);
                                }
                              }
                            }}
                          >
                            {tag.tagName}
                            <Check
                              className={cn(
                                "ml-auto",
                                currentLink.tags?.some(
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
                                  currentLink.urlCode,
                                );
                              setInput("");
                              if (success && tag) {
                                currentLink.tags?.push(tag);
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
            {currentLink.tags && currentLink.tags.length > 0 ? (
              <p className="text-xs">
                {currentLink.tags.length}{" "}
                {currentLink.tags.length == 1 ? "tag" : "tags"}
              </p>
            ) : (
              <p className="text-xs">No tags</p>
            )}
          </div>
        </div>
      </div>
      <Separator className="md:hidden block w-full my-4" />
      <div className="md:hidden flex flex-row items-center justify-start gap-2">
        <Button
          onClick={async () => {
            await navigator.clipboard.writeText(currentLink.shortUrl);
            setJustCopied(true);
            setTimeout(() => {
              setJustCopied(false);
            }, 1000);
          }}
          variant={"secondary"}
          className="p-1.5! h-fit!"
        >
          {justCopied ? (
            <>
              <CopyCheck />
              Copied
            </>
          ) : (
            <>
              <Copy />
              Copy
            </>
          )}
        </Button>
        <Dialog>
          <DialogTrigger asChild>
            <Button variant={"outline"} className="p-1.5! h-fit!">
              <Share2 />
              Share
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Share your Shortn Link</DialogTitle>
              <DialogDescription>
                Share your link across social media.
              </DialogDescription>
            </DialogHeader>
            <div className="w-full grid grid-cols-5 gap-4">
              <FacebookShareButton
                url={currentLink.shortUrl}
                quote={"Check out this link shortened with Shortn.at"}
              >
                <div className="col-span-1 w-full h-auto aspect-square border rounded flex items-center justify-center p-1 max-w-16 mx-auto">
                  <FacebookIcon size={32} round />
                </div>
              </FacebookShareButton>
              <RedditShareButton
                url={currentLink.shortUrl}
                title={"Check out this link shortened with Shortn.at"}
              >
                <div className="col-span-1 w-full h-auto aspect-square border rounded flex items-center justify-center p-1 max-w-16 mx-auto">
                  <RedditIcon size={32} round />
                </div>
              </RedditShareButton>
              <TwitterShareButton
                url={currentLink.shortUrl}
                title={"Check out this link shortened with Shortn.at"}
              >
                <div className="col-span-1 w-full h-auto aspect-square border rounded flex items-center justify-center p-1 max-w-16 mx-auto">
                  <TwitterIcon size={32} round />
                </div>
              </TwitterShareButton>
              <WhatsappShareButton
                url={currentLink.shortUrl}
                title={"Check out this link shortened with Shortn.at"}
                separator=" "
              >
                <div className="col-span-1 w-full h-auto aspect-square border rounded flex items-center justify-center p-1 max-w-16 mx-auto">
                  <WhatsappIcon size={32} round />
                </div>
              </WhatsappShareButton>
              <EmailShareButton
                url={currentLink.shortUrl}
                subject="Checkout my Shortn.at Link!"
                body="Checkout this link shortened with Shortn.at"
              >
                <div className="col-span-1 w-full h-auto aspect-square border rounded flex items-center justify-center p-1 max-w-16 mx-auto">
                  <EmailIcon size={32} round />
                </div>
              </EmailShareButton>
            </div>
            <Separator />
            <div className="relative w-full flex items-center">
              <Input
                value={currentLink.shortUrl}
                readOnly
                className="w-full bg-background"
              />
              <Button
                onClick={async () => {
                  await navigator.clipboard.writeText(currentLink.shortUrl);
                  setJustCopied(true);
                  setTimeout(() => {
                    setJustCopied(false);
                  }, 1000);
                }}
                variant={"secondary"}
                className="h-fit! py-1! px-2 text-xs font-bold z-10 hover:cursor-pointer absolute right-2"
              >
                {justCopied ? <>Copied</> : <>Copy</>}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
        <Button
          asChild
          variant={"outline"}
          className="p-1.5! h-fit! aspect-square!"
        >
          <Link href={`/dashboard/links/${currentLink.urlCode}/edit`}>
            <Edit2 />
          </Link>
        </Button>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant={"outline"}
              className="p-1.5! h-fit! aspect-square!"
            >
              <Ellipsis />
            </Button>
          </PopoverTrigger>
          <ScrollPopoverContent className="w-[200px] flex flex-col px-0! py-1 gap-1">
            <Button
              variant={"outline"}
              onClick={async () => {
                const response = await deleteShortn(currentLink.urlCode);
                if (response.success) {
                  toast.success(
                    `Link ${currentLink.urlCode} was successfully deleted.`,
                  );
                } else {
                  toast.error("There was a problem deleting your link.");
                }
                router.push(`/dashboard/links`);
              }}
              className="w-full border-none! rounded-none! justify-start! shadow-none! "
            >
              <Trash2 /> Delete
            </Button>
          </ScrollPopoverContent>
        </Popover>
      </div>
    </div>
  );
};
