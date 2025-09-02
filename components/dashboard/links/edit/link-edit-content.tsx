"use client";

import {
  Command,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormRootError,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Link, useRouter } from "@/i18n/navigation";
import { useUser } from "@/utils/UserContext";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import z from "zod";
import { Label } from "@/components/ui/label";
import { Popover, PopoverTrigger } from "@/components/ui/popover";
import { cn, fetchApi } from "@/lib/utils";
import { Check, ChevronsUpDown, LockIcon, X } from "lucide-react";
import { createTag } from "@/app/actions/tagActions";
import { ITag } from "@/models/url/Tag";
import { Switch } from "@/components/ui/switch";
import { IUrl } from "@/models/url/UrlV3";
import { updateShortnData } from "@/app/actions/linkActions";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
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
const urlFormSchema = z.object({
  title: z
    .string()
    .min(3, "Your title must be at least 3 characters long.")
    .max(52, "Your title can't be longer than 52 characters."),
  custom_code: z
    .union([
      z
        .string()
        .min(3, "Back-half must be at least 3 characters long")
        .max(52, "Back-half can't be longer than 52 characters")
        .regex(
          /^[a-zA-Z0-9_-]+$/,
          "Back-half can only contain letters, numbers, dashes (-), and underscores (_)"
        ),
      z.literal(""),
    ])
    .optional(),
  applyToQR: z.boolean().default(false).optional(),
});

export const LinksEditContent = ({ url }: { url: IUrl }) => {
  const session = useUser();

  const router = useRouter();

  const [creating, setCreating] = useState(false);

  const urlForm = useForm<z.infer<typeof urlFormSchema>>({
    resolver: zodResolver(urlFormSchema),
    defaultValues: {
      title: url.title || "",
      custom_code: url.urlCode,
      applyToQR: false,
    },
  });

  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [tagOptions, setTagOptions] = useState<ITag[]>([]);

  const [tags, setTags] = useState<ITag[]>((url.tags as ITag[]) || []);

  const [notFound, setNotFound] = useState(false);
  const [shouldShowAddTag, setExactTagMatch] = useState(true);

  const isMobile = useIsMobile();

  useEffect(() => {
    if (!session.user) {
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
  }, [input, session.user]);

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

  return (
    <div className="w-full flex flex-col gap-6 items-start col-span-full">
      <h1 className="font-bold lg:text-3xl md:text-2xl sm:text-xl text-lg">
        Edit your Shortn link
      </h1>
      <div className="rounded bg-background lg:p-6 md:p-4 p-3 w-full flex flex-col gap-4">
        <div className="flex flex-col gap-2 items-start">
          <h1 className="lg:text-2xl md:text-xl sm:text-lg text-base font-bold">
            Details
          </h1>
        </div>
        <Form {...urlForm}>
          <form
            onSubmit={urlForm.handleSubmit(async (data) => {
              setCreating(true);
              const response = await updateShortnData({
                urlCode: url.urlCode,
                title: data.title,
                tags: tags,
                applyToQRCode: data.applyToQR ?? false,
                custom_code: data.custom_code ? data.custom_code : undefined,
              });
              if (response.success) {
                router.push(`/dashboard/links/${response.urlCode}/details`);
                return;
              } else {
                switch (response.message) {
                  case "duplicate":
                    urlForm.setError("custom_code", {
                      type: "manual",
                      message: "A shortn with that back half already exists.",
                    });
                    break;
                  case "no-user":
                    urlForm.setError("root", {
                      type: "manual",
                      message: "You don't seem to be logged in.",
                    });
                    break;
                  case "custom-restricted":
                    urlForm.setError("custom_code", {
                      type: "manual",
                      message:
                        "You are not allowed to use custom back halves without a PRO account.",
                    });
                    break;
                  default:
                    urlForm.setError("root", {
                      type: "manual",
                      message: "An unexpected error occurred.",
                    });
                }
                setCreating(false);
              }
            })}
            className="w-full flex flex-col gap-4"
          >
            <FormField
              control={urlForm.control}
              name="title"
              render={({ field }) => (
                <FormItem className="w-full">
                  <FormLabel>Title</FormLabel>
                  <FormControl>
                    <Input className="w-full" placeholder="" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={urlForm.control}
              name="custom_code"
              render={({ field }) => (
                <FormItem className="w-full">
                  <FormLabel>
                    Custom Back-half{" "}
                    {session.user?.plan.subscription != "pro" && (
                      <HoverCard>
                        <HoverCardTrigger>
                          <LockIcon className="w-3! h-3!" />
                        </HoverCardTrigger>
                        <HoverCardContent asChild>
                          <div className="w-full max-w-[300px] p-2! px-3! rounded bg-primary text-primary-foreground flex flex-col gap-0 items-start text-xs cursor-help">
                            <p className="text-sm font-bold">
                              Unlock custom codes
                            </p>
                            <p>
                              <Link
                                href={`/dashboard/subscription`}
                                className="underline hover:cursor-pointer"
                              >
                                Upgrade
                              </Link>{" "}
                              to access link stats.
                            </p>
                          </div>
                        </HoverCardContent>
                      </HoverCard>
                    )}
                  </FormLabel>
                  <FormControl>
                    <Input
                      disabled={session.user?.plan.subscription != "pro"}
                      className="w-full"
                      placeholder=""
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="w-full flex flex-col gap-2">
              <Label className="font-semibold">Tags</Label>
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
                                    "bg-secondary text-secondary-foreground shadow-xs hover:bg-secondary/80 h-full! p-1! text-sm rounded-none! hover:cursor-pointer"
                                  )}
                                >
                                  {tag.tagName}
                                  <X className="w-3! h-3!" />
                                </p>
                              );
                            })
                          : "Add tags..."}
                      </div>

                      <ChevronsUpDown className="opacity-50" />
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="w-full min-w-[250px] p-0 pt-6">
                    <DialogHeader className="px-4 text-left">
                      <DialogTitle>Edit tags</DialogTitle>
                      <DialogDescription>
                        Add or remove tags to make it easier to find your link.
                      </DialogDescription>
                    </DialogHeader>
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
                                const added = tags?.some(
                                  (_tag) => _tag.id == tag.id
                                );
                                if (added) {
                                  setTags((prev) => {
                                    const n = [...prev];
                                    const index = n.findIndex(
                                      (t) => t.id == tag.id
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
                                if (!session.user?.sub) return;
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
                              Create &quot;{input}&quot;
                            </CommandItem>
                          )}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                    {tags != url.tags && (
                      <div className="w-full flex flex-row items-center gap-2 justify-start px-2 pb-2 -mt-2">
                        <Button
                          onClick={() => {
                            setOpen(false);
                          }}
                        >
                          Save
                        </Button>
                        <Button
                          variant={"secondary"}
                          onClick={() => {
                            setTags(url.tags as ITag[]);
                            setOpen(false);
                          }}
                        >
                          Cancel
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
                                    "bg-secondary text-secondary-foreground shadow-xs hover:bg-secondary/80 h-full! p-1! text-sm rounded-none! hover:cursor-pointer"
                                  )}
                                >
                                  {tag.tagName}
                                  <X className="w-3! h-3!" />
                                </p>
                              );
                            })
                          : "Add tags..."}
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
                                const added = tags?.some(
                                  (_tag) => _tag.id == tag.id
                                );
                                if (added) {
                                  setTags((prev) => {
                                    const n = [...prev];
                                    const index = n.findIndex(
                                      (t) => t.id == tag.id
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
                                if (!session.user?.sub) return;
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
                              Create &quot;{input}&quot;
                            </CommandItem>
                          )}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </ScrollPopoverContent>
                </Popover>
              )}
            </div>
            {url.qrCodeId && (
              <FormField
                control={urlForm.control}
                name="applyToQR"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between">
                    <div className="space-y-0.5">
                      <FormLabel>Apply changes to QR Code</FormLabel>
                      <FormDescription>
                        Do you want these changes to reflect in the attached QR
                        Code?
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
                  router.push(`/dashboard/links`);
                }}
                type="button"
                variant={"secondary"}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={creating}>
                {creating ? "Saving..." : "Save changes"}
              </Button>
              <FormRootError />
            </div>
          </form>
        </Form>
      </div>
    </div>
  );
};
