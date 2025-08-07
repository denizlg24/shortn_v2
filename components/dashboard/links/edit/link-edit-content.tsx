"use client";

import {
  Command,
  CommandEmpty,
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
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useRouter } from "@/i18n/navigation";
import { IQRCode } from "@/models/url/QRCodeV2";
import { useUser } from "@/utils/UserContext";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState, useEffect, useTransition } from "react";
import { useForm } from "react-hook-form";
import z from "zod";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { Check, ChevronsUpDown, X } from "lucide-react";
import {
  createTag,
  getTagById,
  getTags,
  getTagsByQuery,
} from "@/app/actions/tagActions";
import { ITag } from "@/models/url/Tag";
import { Switch } from "@/components/ui/switch";
import { IUrl } from "@/models/url/UrlV3";
import { getShortn, updateShortnData } from "@/app/actions/linkActions";

const urlFormSchema = z.object({
  title: z
    .string()
    .min(3, "Your title must be at least 3 characters long.")
    .max(52, "Your title can't be longer than 52 characters."),
  applyToQR: z.boolean().default(false).optional(),
});

export const LinksEditContent = ({ urlCode }: { urlCode: string }) => {
  const session = useUser();

  const router = useRouter();

  const [creating, setCreating] = useState(false);

  const [url, setUrl] = useState<IUrl | undefined>(undefined);

  const urlForm = useForm<z.infer<typeof urlFormSchema>>({
    resolver: zodResolver(urlFormSchema),
    defaultValues: {
      title: "",
      applyToQR: false,
    },
  });

  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [tagOptions, setTagOptions] = useState<ITag[]>([]);

  const [tags, setTags] = useState<ITag[]>([]);

  const [notFound, setNotFound] = useState(false);
  const [fetching, startTransition] = useTransition();
  const [shouldShowAddTag, setExactTagMatch] = useState(true);

  useEffect(() => {
    if (!session.user) {
      return;
    }

    if (input.trim() === "") {
      getTags(session.user!.sub).then((tags) => {
        setTagOptions(tags);
      });
      return;
    }
  }, [session.user]);

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

  const getUrlWrapper = async (id: string) => {
    if (!session.user?.sub) {
      return;
    }
    const response = await getShortn(session.user?.sub, id);
    if (response.success && response.url) {
      setUrl(response.url);
      setTags(response.url.tags as ITag[]);
      urlForm.reset({ title: response.url.title });
    }
  };

  useEffect(() => {
    if (!session.user) {
      return;
    }
    getUrlWrapper(urlCode);
  }, [urlCode, session.user]);

  useEffect(() => {
    const hasExactMatch = tagOptions.some((tag) => tag.tagName === input);

    const _shouldShowAddTag =
      input != "" && (!hasExactMatch || tagOptions.length === 0);

    setExactTagMatch(_shouldShowAddTag);
  }, [tagOptions, notFound, input]);

  if (!url) {
    return <Skeleton className="w-full col-span-full aspect-video h-auto" />;
  }
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
              });
              if (response.success) {
                router.push(
                  `/dashboard/${session.user?.sub.split("|")[1]}/links/${
                    url.urlCode
                  }/details`
                );
              } else {
                urlForm.setError("root", {
                  type: "manual",
                  message: "There was a problem updating your Shortn link.",
                });
              }
              setCreating(false);
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
            <div className="w-full flex flex-col gap-2">
              <Label className="font-semibold">Tags</Label>
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
                              const added = tags?.some(
                                (_tag) => _tag.id == tag.id
                              );
                              if (added) {
                                setTags((prev) => {
                                  const n = [...prev];
                                  const index = n.findIndex((t) => {
                                    t.id == tag.id;
                                  });
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
                            onSelect={() => {
                              startTransition(async () => {
                                if (!session.user?.sub) return;
                                const response = await createTag(
                                  session.user.sub,
                                  input
                                );
                                if (response.success && response.tag) {
                                  setTags((prev) => {
                                    const n = [...prev, response.tag as ITag];
                                    return n;
                                  });
                                  setInput("");
                                }
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
                  router.push(
                    `/dashboard/${session.user?.sub.split("|")[1]}/links`
                  );
                }}
                type="button"
                variant={"secondary"}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={creating}>
                {creating ? "Saving..." : "Save changes"}
              </Button>
            </div>
          </form>
        </Form>
      </div>
    </div>
  );
};
