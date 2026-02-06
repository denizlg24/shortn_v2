"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormRootError,
} from "@/components/ui/form";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Spinner } from "@/components/ui/spinner";
import { useRouter } from "@/i18n/navigation";
import { toast } from "sonner";
import { useState, useEffect, ReactNode } from "react";
import {
  createBioPage,
  addLinkToBioPage,
  getUserBioPages,
} from "@/app/actions/bioPageActions";
import { NotepadText, Plus, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTranslations } from "next-intl";

type BioPage = {
  _id: string;
  slug: string;
  title: string;
  avatarUrl?: string;
};

export const AddToBioPageDialog = ({
  linkId,
  linkTitle,
  trigger,
  onSuccess,
}: {
  linkId: string;
  linkTitle: string;
  trigger?: ReactNode;
  onSuccess?: (_slug: string) => void;
}) => {
  const t = useTranslations("add-to-bio-page");

  const pageFormSchema = z.object({
    title: z.string().max(100, t("validation.title-too-long")).optional(),
    slug: z
      .string()
      .min(3, t("validation.slug-too-short"))
      .max(52, t("validation.slug-too-long"))
      .regex(/^[a-zA-Z0-9_-]+$/, t("validation.slug-invalid-chars")),
  });

  const [open, setOpen] = useState(false);
  const [bioPages, setBioPages] = useState<BioPage[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [adding, setAdding] = useState<string | null>(null);
  const router = useRouter();

  const pageForm = useForm<z.infer<typeof pageFormSchema>>({
    resolver: zodResolver(pageFormSchema),
    defaultValues: {
      title: "",
      slug: "",
    },
  });

  useEffect(() => {
    const loadBioPages = async () => {
      setLoading(true);
      const result = await getUserBioPages();
      if (result.success) {
        setBioPages(result.bioPages as BioPage[]);
      }
      setLoading(false);
    };
    if (open) {
      loadBioPages();
      pageForm.reset();
    }
  }, [open, pageForm]);

  const handleCreateNew = async () => {
    setCreating(true);

    const valid = await pageForm.trigger();
    if (!valid) {
      setCreating(false);
      return;
    }

    const data = pageForm.getValues();
    const result = await createBioPage({
      title: data.title || undefined,
      slug: data.slug,
      urlCode: undefined,
    });

    if (result.success) {
      const addResult = await addLinkToBioPage({
        slug: data.slug,
        linkId,
      });

      if (addResult.success) {
        toast.success(t("toast.created-and-added"));
        setOpen(false);
        pageForm.reset();
        onSuccess?.(data.slug);
        router.push(`/dashboard/pages/${data.slug}/customize`);
      } else {
        pageForm.setError("root", {
          message: t("errors.page-created-link-failed"),
        });
      }
    } else {
      switch (result.message) {
        case "duplicate":
          pageForm.setError("slug", {
            message: t("errors.duplicate"),
          });
          break;
        case "plan-restricted":
          pageForm.setError("root", {
            message: t("errors.plan-restricted"),
          });
          break;
        case "no-user":
          pageForm.setError("root", {
            message: t("errors.no-user"),
          });
          break;
        case "server-error":
          pageForm.setError("root", {
            message: t("errors.server-error"),
          });
          break;
        default:
          pageForm.setError("root", {
            message: t("errors.create-failed"),
          });
      }
    }
    setCreating(false);
  };

  const handleAddToExisting = async (slug: string) => {
    setAdding(slug);
    const result = await addLinkToBioPage({
      slug,
      linkId,
    });

    if (result.success) {
      toast.success(t("toast.link-added"));
      setOpen(false);
      onSuccess?.(slug);
      router.refresh();
    } else {
      if (result.message === "link-already-added") {
        toast.error(t("toast.link-already-added"));
      } else {
        toast.error(t("toast.add-failed"));
      }
    }
    setAdding(null);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline">
            <NotepadText className="h-4 w-4 mr-2" />
            {t("trigger")}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>
            {t("description", { linkTitle })}
          </DialogDescription>
        </DialogHeader>
        <Tabs defaultValue="add" className="w-full">
          <TabsList className="w-full">
            <TabsTrigger value="add">{t("tabs.add")}</TabsTrigger>
            <TabsTrigger value="create">{t("tabs.create")}</TabsTrigger>
          </TabsList>
          <Separator className="mt-1" />
          <TabsContent value="add">
            <div className="flex flex-col gap-3">
              <h3 className="text-sm font-semibold">{t("add-existing")}</h3>
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Spinner className="h-6 w-6" />
                </div>
              ) : bioPages.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  {t("no-pages")}
                </p>
              ) : (
                <ScrollArea className="h-60 rounded-md border bg-muted p-2">
                  <div className="flex flex-col gap-2">
                    {bioPages.map((page) => (
                      <button
                        key={page._id}
                        onClick={() => handleAddToExisting(page.slug)}
                        disabled={adding !== null}
                        className={cn(
                          "bg-background flex items-center gap-3 p-3 rounded-lg border hover:bg-background/50 transition-colors text-left",
                          adding === page.slug && "opacity-50",
                        )}
                      >
                        <Avatar className="h-10 w-10 rounded-md">
                          <AvatarImage src={page.avatarUrl} alt={page.title} />
                          <AvatarFallback className="rounded-md">
                            <NotepadText className="h-5 w-5" />
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{page.title}</p>
                          <p className="text-sm text-muted-foreground truncate">
                            /{page.slug}
                          </p>
                        </div>
                        {adding === page.slug ? (
                          <Spinner className="h-4 w-4 shrink-0" />
                        ) : (
                          <Check className="h-4 w-4 shrink-0 opacity-0" />
                        )}
                      </button>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </div>
          </TabsContent>
          <TabsContent value="create">
            <div className="flex flex-col gap-3">
              <h3 className="text-sm font-semibold">{t("create-new")}</h3>
              <Form {...pageForm}>
                <form className="flex flex-col gap-3">
                  <FormField
                    control={pageForm.control}
                    name="title"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("form.title-label")}</FormLabel>
                        <FormControl>
                          <Input
                            placeholder={t("form.title-placeholder")}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={pageForm.control}
                    name="slug"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("form.url-label")}</FormLabel>
                        <FormControl>
                          <Input
                            placeholder={t("form.url-placeholder")}
                            {...field}
                            onChange={(e) =>
                              field.onChange(
                                e.target.value
                                  .toLowerCase()
                                  .replace(/\s+/g, "-"),
                              )
                            }
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormRootError />
                  <Button
                    type="button"
                    onClick={handleCreateNew}
                    disabled={creating}
                  >
                    {creating ? (
                      <>
                        {t("form.creating")}
                        <Spinner className="h-4 w-4" />
                      </>
                    ) : (
                      <>
                        {t("form.create-and-add")}
                        <Plus className="h-4 w-4" />
                      </>
                    )}
                  </Button>
                </form>
              </Form>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
