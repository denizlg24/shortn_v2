import {
  addTagToLink,
  createAndAddTagToUrl,
  getTags,
  getTagsByQuery,
  removeTagFromLink,
} from "@/app/actions/tagActions";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { ITag } from "@/models/url/Tag";
import { IUrl } from "@/models/url/UrlV3";
import { useUser } from "@/utils/UserContext";
import { format } from "date-fns";
import {
  Calendar,
  ChartNoAxesColumn,
  Check,
  Copy,
  CopyCheck,
  Edit2,
  Ellipsis,
  LinkIcon,
  Loader2,
  LockIcon,
  NotepadText,
  PlusCircle,
  QrCode,
  Share2,
  Tags,
  Trash2,
} from "lucide-react";
import { useState, useTransition, useEffect } from "react";

export const LinkCard = ({
  link,
  addTag,
  removeTag,
  tags,
}: {
  link: IUrl;
  addTag: (tagId: string) => void;
  removeTag: (tagId: string) => void;
  tags: string[];
}) => {
  const session = useUser();

  const [currentLink, setCurrentLink] = useState(link);
  const [input, setInput] = useState("");
  const [tagOptions, setTagOptions] = useState<ITag[]>([]);
  const [notFound, setNotFound] = useState(false);
  const [fetching, startTransition] = useTransition();
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
        getTags(session.user!.sub).then((tags) => {
          setTagOptions(tags);
        });
        setNotFound(false);
        return;
      }
      startTransition(() => {
        getTagsByQuery(input, session.user!.sub).then((tags) => {
          setTagOptions(tags);
          setNotFound(tags.length === 0);
        });
      });
    }, 300);

    return () => clearTimeout(delayDebounce);
  }, [input]);

  useEffect(() => {
    const hasExactMatch = tagOptions.some((tag) => tag.tagName === input);

    const _shouldShowAddTag =
      input != "" && (!hasExactMatch || tagOptions.length === 0);

    setExactTagMatch(_shouldShowAddTag);
  }, [tagOptions, notFound, input]);

  if (!session.user) {
    return null;
  }

  return (
    <div className="lg:p-6 sm:p-4 p-3 rounded bg-background shadow w-full flex flex-col gap-0">
      <div className="w-full flex flex-row items-start justify-between">
        <Link
          href={`/dashboard/${session.user.sub.split("|")[1]}/links/${
            currentLink.urlCode
          }/details`}
          className="font-bold lg:text-lg md:text-base text-sm hover:underline underline-offset-4 truncate"
        >
          {currentLink.title}
        </Link>
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
          <Button variant={"outline"}>
            <Share2 />
            Share
          </Button>
          <Button asChild variant={"outline"} className="p-2! aspect-square!">
            <Link
              href={`/dashboard/${session.user.sub.split("|")[1]}/links/${
                link.urlCode
              }/edit`}
            >
              <Edit2 />
            </Link>
          </Button>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant={"outline"} className="p-2! aspect-square!">
                <Ellipsis />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[200px] flex flex-col px-0! py-1 gap-1">
              <Button
                variant={"outline"}
                className="w-full border-none! rounded-none! justify-start! shadow-none! "
              >
                <Trash2 /> Delete
              </Button>
              <Button
                variant={"outline"}
                className="w-full border-none! rounded-none! justify-start! shadow-none! "
              >
                <LinkIcon /> View link details
              </Button>
              <Button
                variant={"outline"}
                className="w-full border-none! rounded-none! justify-start! shadow-none! "
              >
                <QrCode /> View QR Code
              </Button>
              <Button
                variant={"outline"}
                className="w-full border-none! rounded-none! justify-start! shadow-none! "
              >
                <NotepadText /> Add to a page
              </Button>
            </PopoverContent>
          </Popover>
        </div>
      </div>
      <div className="w-full flex flex-row justify-start">
        <Link
          href={currentLink.shortUrl}
          className="font-semibold lg:text-base md:text-sm text-xs hover:underline text-blue-500 truncate"
        >
          {currentLink.shortUrl.split("://")[1]}
        </Link>
      </div>
      <div className="w-full flex flex-row justify-start">
        <Link
          href={currentLink.longUrl}
          className="lg:text-base md:text-sm text-xs hover:underline truncate"
        >
          {currentLink.longUrl}
        </Link>
      </div>
      <div className="w-full mt-4 flex flex-row sm:items-center items-end justify-between">
        <div className="w-full flex sm:flex-row flex-col sm:items-center items-start sm:gap-4 gap-2">
          <div className="flex flex-row items-center gap-1">
            <ChartNoAxesColumn className="w-4 h-4" />
            {session.user.plan.subscription == "free" ? (
              <HoverCard>
                <HoverCardTrigger asChild>
                  <Button
                    className="p-0! px-1! rounded-none! h-fit text-xs font-normal gap-1!"
                    variant={"secondary"}
                  >
                    <LockIcon className="w-3! h-3!" />
                    Click Data
                  </Button>
                </HoverCardTrigger>
                <HoverCardContent asChild>
                  <div className="w-full max-w-[300px] p-2! px-3! rounded bg-primary text-primary-foreground flex flex-col gap-0 items-start text-xs cursor-help">
                    <p className="text-sm font-bold">Unlock click data</p>
                    <div className="w-full flex flex-row gap-1 items-center">
                      <Link
                        href={`/dashboard/${
                          session.user.sub.split("|")[1]
                        }/subscription`}
                        className="underline hover:cursor-pointer"
                      >
                        Upgrade
                      </Link>
                      <p>to access link stats.</p>
                    </div>
                  </div>
                </HoverCardContent>
              </HoverCard>
            ) : (
              <p className="p-0! px-1! rounded-none! h-fit text-xs font-normal gap-1!">
                {link.clicks.total}
                {link.clicks.total == 1 ? " click" : " clicks"}
              </p>
            )}
          </div>
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
                      tags.some((t) => t == tag.id) && "border-primary"
                    )}
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
                <PopoverContent
                  align="start"
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
                            onSelect={async (val) => {
                              const added = currentLink.tags?.some(
                                (_tag) => _tag.id == tag.id
                              );
                              if (added) {
                                const { success } = await removeTagFromLink(
                                  currentLink.urlCode,
                                  session.user!.sub,
                                  tag.id
                                );
                                if (success) {
                                  const newLink = currentLink;
                                  newLink.tags =
                                    newLink.tags?.filter(
                                      (_t) => _t.id != tag.id
                                    ) || [];
                                  setCurrentLink(newLink);
                                  tagOpenChange(false);
                                }
                              } else {
                                const { success } = await addTagToLink(
                                  currentLink.urlCode,
                                  session.user!.sub,
                                  tag.id
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
                            onSelect={() => {
                              startTransition(async () => {
                                const { success, tag } =
                                  await createAndAddTagToUrl(
                                    input,
                                    session.user!.sub,
                                    currentLink.urlCode
                                  );
                                setInput("");
                                if (success && tag) {
                                  currentLink.tags?.push(tag);
                                }
                                tagOpenChange(false);
                              });
                            }}
                          >
                            Create "{input}"
                          </CommandItem>
                        )}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
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
        <div className="flex flex-row items-center h-6 gap-2 sm:pb-0 pb-2">
          <HoverCard>
            <HoverCardTrigger asChild>
              <Button variant={"outline"} className="p-2! aspect-square!">
                <QrCode />
              </Button>
            </HoverCardTrigger>
            <HoverCardContent asChild>
              <div className="w-full max-w-[300px] p-2! px-3! rounded bg-primary text-primary-foreground flex flex-col gap-0 items-start text-xs cursor-help">
                <p className="text-sm font-bold">Create QR Code</p>
              </div>
            </HoverCardContent>
          </HoverCard>

          <HoverCard>
            <HoverCardTrigger asChild>
              <Button variant={"outline"} className="p-2! aspect-square!">
                <NotepadText />
              </Button>
            </HoverCardTrigger>
            <HoverCardContent asChild>
              <div className="w-full max-w-[300px] p-2! px-3! rounded bg-primary text-primary-foreground flex flex-col gap-0 items-start text-xs cursor-help">
                <p className="text-sm font-bold">Add to a page</p>
              </div>
            </HoverCardContent>
          </HoverCard>
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
        <Button className="p-1.5! h-fit!" variant={"outline"}>
          <Share2 />
          Share
        </Button>
        <Button
          asChild
          variant={"outline"}
          className="p-1.5! h-fit! aspect-square!"
        >
          <Link
            href={`/dashboard/${session.user.sub.split("|")[1]}/links/${
              link.urlCode
            }/edit`}
          >
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
          <PopoverContent className="w-[200px] flex flex-col px-0! py-1 gap-1">
            <Button
              variant={"outline"}
              className="w-full border-none! rounded-none! justify-start! shadow-none! "
            >
              <Trash2 /> Delete
            </Button>
            <Button
              variant={"outline"}
              className="w-full border-none! rounded-none! justify-start! shadow-none! "
            >
              <LinkIcon /> View link details
            </Button>
            <Button
              variant={"outline"}
              className="w-full border-none! rounded-none! justify-start! shadow-none! "
            >
              <QrCode /> View QR Code
            </Button>
            <Button
              variant={"outline"}
              className="w-full border-none! rounded-none! justify-start! shadow-none! "
            >
              <NotepadText /> Add to a page
            </Button>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
};
