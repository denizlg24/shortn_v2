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
import z from "zod";

type BioPage = {
  _id: string;
  slug: string;
  title: string;
  avatarUrl?: string;
};

const pageFormSchema = z.object({
  title: z
    .string()
    .max(100, "Title can't be longer than 100 characters")
    .optional(),
  slug: z
    .string()
    .min(3, "Page URL must be at least 3 characters long")
    .max(52, "Page URL can't be longer than 52 characters")
    .regex(
      /^[a-zA-Z0-9_-]+$/,
      "Page URL can only contain letters, numbers, dashes (-), and underscores (_)",
    ),
});

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
    if (open) {
      loadBioPages();
      // Reset form when dialog opens
      pageForm.reset();
    }
  }, [open, pageForm]);

  const loadBioPages = async () => {
    setLoading(true);
    const result = await getUserBioPages();
    if (result.success) {
      setBioPages(result.bioPages as BioPage[]);
    }
    setLoading(false);
  };

  const handleCreateNew = async () => {
    setCreating(true);

    // Validate form
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
      // Add link to the newly created page
      const addResult = await addLinkToBioPage({
        slug: data.slug,
        linkId,
      });

      if (addResult.success) {
        toast.success("Bio page created and link added");
        setOpen(false);
        pageForm.reset();
        onSuccess?.(data.slug);
        router.push(`/dashboard/pages/${data.slug}/customize`);
      } else {
        pageForm.setError("root", {
          message: "Page created but failed to add link",
        });
      }
    } else {
      switch (result.message) {
        case "duplicate":
          pageForm.setError("slug", {
            message:
              "This page URL is already taken. Please choose another one.",
          });
          break;
        case "plan-restricted":
          pageForm.setError("root", {
            message: "Your current plan does not allow creating a new page.",
          });
          break;
        case "no-user":
          pageForm.setError("root", {
            message: "User not found. Please log in again.",
          });
          break;
        case "server-error":
          pageForm.setError("root", {
            message: "Server error. Please try again later.",
          });
          break;
        default:
          pageForm.setError("root", {
            message: "Failed to create bio page. Please try again.",
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
      toast.success("Link added to bio page");
      setOpen(false);
      onSuccess?.(slug);
      router.refresh();
    } else {
      if (result.message === "link-already-added") {
        toast.error("This link is already on this bio page");
      } else {
        toast.error("Failed to add link to bio page");
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
            Add to a page
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Add to Bio Page</DialogTitle>
          <DialogDescription>
            Add &quot;{linkTitle}&quot; to an existing bio page or create a new
            one.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {/* Create New Section */}
          <div className="flex flex-col gap-3">
            <h3 className="text-sm font-semibold">Create New Page</h3>
            <Form {...pageForm}>
              <form className="flex flex-col gap-3">
                <FormField
                  control={pageForm.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Title (optional)</FormLabel>
                      <FormControl>
                        <Input placeholder="My Bio Page" {...field} />
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
                      <FormLabel>Page URL *</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="my-page"
                          {...field}
                          onChange={(e) =>
                            field.onChange(
                              e.target.value.toLowerCase().replace(/\s+/g, "-"),
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
                      <Spinner className="h-4 w-4 mr-2" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Plus className="h-4 w-4 mr-2" />
                      Create & Add Link
                    </>
                  )}
                </Button>
              </form>
            </Form>
          </div>

          <Separator />

          {/* Existing Pages Section */}
          <div className="flex flex-col gap-3">
            <h3 className="text-sm font-semibold">Add to Existing Page</h3>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Spinner className="h-6 w-6" />
              </div>
            ) : bioPages.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No bio pages yet. Create one above!
              </p>
            ) : (
              <ScrollArea className="h-[240px] rounded-md border p-2">
                <div className="flex flex-col gap-2">
                  {bioPages.map((page) => (
                    <button
                      key={page._id}
                      onClick={() => handleAddToExisting(page.slug)}
                      disabled={adding !== null}
                      className={cn(
                        "flex items-center gap-3 p-3 rounded-lg border hover:bg-accent transition-colors text-left",
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
        </div>
      </DialogContent>
    </Dialog>
  );
};
