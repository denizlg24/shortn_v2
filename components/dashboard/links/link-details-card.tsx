"use client";
import {
  deleteShortn,
  generateCSV,
  updateShortnData,
} from "@/app/actions/linkActions";
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
import { Link, useRouter } from "@/i18n/navigation";
import { cn, fetchApi } from "@/lib/utils";
import { ITag } from "@/models/url/Tag";
import { TUrl } from "@/models/url/UrlV3";
import { format } from "date-fns";

import {
  Calendar,
  Check,
  Copy,
  CopyCheck,
  Edit2,
  Ellipsis,
  Eye,
  EyeOff,
  FileChartColumn,
  KeyRound,
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
import { usePlan } from "@/hooks/use-plan";

export const LinkDetailsCard = ({
  currentLink: initialLink,
}: {
  currentLink: TUrl;
}) => {
  const [currentLink, setCurrentLink] = useState<TUrl>(initialLink);
  const { plan } = usePlan();
  const [input, setInput] = useState("");
  const [tagOptions, setTagOptions] = useState<ITag[]>([]);
  const [tagOpen, tagOpenChange] = useState(false);
  const hasExactMatch = tagOptions.some((tag) => tag.tagName === input);

  const shouldShowAddTag =
    input != "" && (!hasExactMatch || tagOptions.length === 0);

  const [justCopied, setJustCopied] = useState(false);

  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [passwordHint, setPasswordHint] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isPasswordLoading, setIsPasswordLoading] = useState(false);

  const isPro = plan === "pro";

  useEffect(() => {
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
  }, [input]);

  const router = useRouter();

  const handlePasswordSubmit = async () => {
    if (!isPro) {
      toast.error("Password protection is only available for Pro users.");
      return;
    }

    setIsPasswordLoading(true);
    try {
      const response = await updateShortnData({
        urlCode: currentLink.urlCode,
        title: currentLink.title || "",
        tags: (currentLink.tags || []) as ITag[],
        applyToQRCode: false,
        longUrl: currentLink.longUrl,
        password: password,
        passwordHint: passwordHint || undefined,
      });

      if (response.success) {
        toast.success("Password protection enabled successfully!");
        setCurrentLink((prev) => ({
          ...prev,
          passwordProtected: true,
          passwordHint: passwordHint || undefined,
        }));
        setPasswordDialogOpen(false);
        setPassword("");
        setPasswordHint("");
        router.refresh();
      } else {
        toast.error("Failed to enable password protection.");
      }
    } catch (error) {
      console.error(error);
      toast.error("An error occurred while updating the link.");
    } finally {
      setIsPasswordLoading(false);
    }
  };

  const handlePasswordRemove = async () => {
    setIsPasswordLoading(true);
    try {
      const response = await updateShortnData({
        urlCode: currentLink.urlCode,
        title: currentLink.title || "",
        tags: (currentLink.tags || []) as ITag[],
        applyToQRCode: false,
        longUrl: currentLink.longUrl,
        removePassword: true,
      });

      if (response.success) {
        toast.success("Password protection removed successfully!");
        setCurrentLink((prev) => ({
          ...prev,
          passwordProtected: false,
          passwordHash: undefined,
          passwordHint: undefined,
        }));
        setPasswordDialogOpen(false);
        setPassword("");
        setPasswordHint("");
        router.refresh();
      } else {
        toast.error("Failed to remove password protection.");
      }
    } catch (error) {
      console.error(error);
      toast.error("An error occurred while updating the link.");
    } finally {
      setIsPasswordLoading(false);
    }
  };

  if (!currentLink) {
    return null;
  }

  return (
    <div className="lg:p-6 sm:p-4 p-3 rounded bg-background shadow w-full flex flex-col gap-0">
      <div className="w-full flex flex-row items-start justify-between">
        <div className="flex flex-col gap-1">
          <div className="flex flex-row items-center gap-2">
            <h1 className="font-bold lg:text-2xl md:text-xl text-lg truncate">
              {currentLink.title}
            </h1>
            {currentLink.passwordProtected && (
              <div className="flex flex-row items-center gap-1 text-secondary-foreground bg-secondary px-2 py-0.5 rounded-full">
                <LockIcon className="w-3 h-3" />
                <span className="text-xs font-medium">Protected</span>
              </div>
            )}
          </div>
          {currentLink.passwordProtected && (
            <p className="text-xs text-muted-foreground">
              This link requires a password to access
            </p>
          )}
        </div>
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

          <Dialog
            open={passwordDialogOpen}
            onOpenChange={setPasswordDialogOpen}
          >
            <DialogTrigger asChild>
              <Button
                variant={"outline"}
                className={cn(
                  "p-2! aspect-square!",
                  currentLink.passwordProtected &&
                    "border-primary bg-secondary",
                )}
              >
                <KeyRound
                  className={cn(
                    currentLink.passwordProtected && "text-primary",
                  )}
                />
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {currentLink.passwordProtected
                    ? "Manage Password Protection"
                    : "Add Password Protection"}
                </DialogTitle>
                <DialogDescription>
                  {currentLink.passwordProtected
                    ? "This link is currently password protected. You can remove the password below."
                    : isPro
                      ? "Protect your link with a password. Only users with the password can access it."
                      : "Password protection is a Pro feature. Upgrade to enable this feature."}
                </DialogDescription>
              </DialogHeader>

              {!isPro ? (
                <div className="flex flex-col gap-4">
                  <div className="p-4 bg-secondary rounded-lg border">
                    <p className="text-sm text-secondary-foreground">
                      Upgrade to Pro to protect your links with passwords.
                    </p>
                  </div>
                  <Button asChild>
                    <Link href="/dashboard/subscription">
                      <LockIcon className="w-4 h-4 mr-2" />
                      Upgrade to Pro
                    </Link>
                  </Button>
                </div>
              ) : currentLink.passwordProtected ? (
                <div className="flex flex-col gap-4">
                  <div className="p-4 bg-secondary rounded-lg border">
                    <div className="flex items-center gap-2 mb-2">
                      <LockIcon className="w-4 h-4 text-secondary-foreground" />
                      <p className="text-sm font-semibold text-secondary-foreground">
                        Password Protected
                      </p>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      This link is currently protected. Users must enter the
                      password to access it.
                    </p>
                    {currentLink.passwordHint && (
                      <p className="text-xs text-muted-foreground mt-2">
                        <strong>Hint:</strong> {currentLink.passwordHint}
                      </p>
                    )}
                  </div>
                  <Button
                    variant="destructive"
                    onClick={handlePasswordRemove}
                    disabled={isPasswordLoading}
                  >
                    {isPasswordLoading
                      ? "Removing..."
                      : "Remove Password Protection"}
                  </Button>
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col gap-2">
                    <label htmlFor="password" className="text-sm font-medium">
                      Password
                    </label>
                    <div className="relative">
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Enter password"
                        className="pr-10"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    <label
                      htmlFor="passwordHint"
                      className="text-sm font-medium"
                    >
                      Password Hint (Optional)
                    </label>
                    <Input
                      id="passwordHint"
                      type="text"
                      value={passwordHint}
                      onChange={(e) => setPasswordHint(e.target.value)}
                      placeholder="e.g., Your birthday"
                      maxLength={100}
                    />
                    <p className="text-xs text-muted-foreground">
                      This hint will be shown to users who need to enter the
                      password.
                    </p>
                  </div>
                  <Button
                    onClick={handlePasswordSubmit}
                    disabled={!password || isPasswordLoading}
                  >
                    {isPasswordLoading
                      ? "Enabling..."
                      : "Enable Password Protection"}
                  </Button>
                </div>
              )}
            </DialogContent>
          </Dialog>

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
              {plan != "pro" ? (
                <HoverCard>
                  <HoverCardTrigger asChild>
                    <Button
                      variant={"outline"}
                      className="w-full border-none! rounded-none! justify-start! shadow-none! relative text-muted-foreground"
                    >
                      <FileChartColumn /> Export raw click data{" "}
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
                        });
                        return response;
                      },
                      {
                        loading: "Preparing your download...",
                        success: (response) => {
                          if (response.success) {
                            const a = document.createElement("a");
                            a.href = response.url;
                            a.download = `${currentLink.urlCode}-clicks-${format(Date.now(), "dd-MM-yyyy")}.csv`;
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
                  <FileChartColumn /> Export raw click data
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
                                  setCurrentLink((prev) => ({
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
                                const { success } = await addTagToLink(
                                  currentLink.urlCode,
                                  tag.id,
                                );
                                if (success) {
                                  setCurrentLink((prev) => ({
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
                                setCurrentLink((prev) => ({
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

        <Button
          variant={"outline"}
          className={cn(
            "p-1.5! h-fit! aspect-square!",
            currentLink.passwordProtected && "border-primary bg-secondary",
          )}
          onClick={() => setPasswordDialogOpen(true)}
        >
          <KeyRound
            className={cn(currentLink.passwordProtected && "text-primary")}
          />
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
          <ScrollPopoverContent
            align="start"
            className="w-[200px] flex flex-col px-0! py-1 gap-1"
          >
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
            {plan != "pro" ? (
              <HoverCard>
                <HoverCardTrigger asChild>
                  <Button
                    variant={"outline"}
                    className="w-full border-none! rounded-none! justify-start! shadow-none! relative text-muted-foreground"
                  >
                    <FileChartColumn /> Export raw click data{" "}
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
                      });
                      return response;
                    },
                    {
                      loading: "Preparing your download...",
                      success: (response) => {
                        if (response.success) {
                          const a = document.createElement("a");
                          a.href = response.url;
                          a.download = `${currentLink.urlCode}-clicks-${format(Date.now(), "dd-MM-yyyy")}.csv`;
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
                <FileChartColumn /> Export raw click data
              </Button>
            )}
          </ScrollPopoverContent>
        </Popover>
      </div>
    </div>
  );
};
