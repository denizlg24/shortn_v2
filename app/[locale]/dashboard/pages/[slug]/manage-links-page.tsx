"use client";

import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { uploadImage } from "@/app/actions/uploadImage";
import { deletePicture } from "@/app/actions/deletePicture";
import {
  updateBioLink,
  removeLinkFromBio,
  reorderBioLinks,
} from "@/app/actions/bioPageActions";
import { useState, useRef } from "react";
import { Spinner } from "@/components/ui/spinner";
import {
  ImageIcon,
  Trash2,
  GripVertical,
  ChevronLeft,
  Link as LinkIcon,
  Calendar,
  CalendarPlus,
  Palette,
  ChartColumnIncreasing,
} from "lucide-react";
import {
  Sortable,
  SortableContent,
  SortableItem,
  SortableItemHandle,
} from "@/components/ui/sortable";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Link } from "@/i18n/navigation";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";

type LinkData = {
  _id: string;
  shortUrl: string;
  title: string;
  createdAt: Date;
  addedAt: Date;
  image?: string;
  customTitle?: string;
};

type LinkChanges = {
  title?: string;
  image?: string;
};

export const ManageLinksPage = ({
  initialLinks,
  slug,
}: {
  initialLinks: LinkData[];
  slug: string;
}) => {
  const [links, setLinks] = useState<LinkData[]>(initialLinks);
  const [linkToDelete, setLinkToDelete] = useState<string | null>(null);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const [editingLinks, setEditingLinks] = useState<Record<string, LinkChanges>>(
    {},
  );
  const [savingLinks, setSavingLinks] = useState<Record<string, boolean>>({});

  const hasChanges = (linkId: string) => {
    return !!editingLinks[linkId];
  };

  const [changingFiles, setChangingFile] = useState(false);
  const handleTitleChange = (linkId: string, newTitle: string) => {
    setEditingLinks((prev) => ({
      ...prev,
      [linkId]: {
        ...prev[linkId],
        title: newTitle,
      },
    }));
  };

  const handleSaveChanges = async (linkId: string) => {
    const changes = editingLinks[linkId];
    if (!changes) return;

    setSavingLinks((prev) => ({ ...prev, [linkId]: true }));

    const result = await updateBioLink({
      slug,
      linkId,
      title: changes.title,
      image: changes.image,
    });

    if (result.success) {
      setLinks((prev) =>
        prev.map((link) =>
          link._id === linkId
            ? {
                ...link,
                customTitle: changes.title ?? link.customTitle,
                image: changes.image ?? link.image,
              }
            : link,
        ),
      );
      setEditingLinks((prev) => {
        const { [linkId]: _, ...rest } = prev;
        return rest;
      });
      toast.success("Changes saved");
    } else {
      toast.error("Failed to save changes");
    }

    setSavingLinks((prev) => ({ ...prev, [linkId]: false }));
  };

  const handleDiscardChanges = (linkId: string) => {
    setEditingLinks((prev) => {
      const { [linkId]: _, ...rest } = prev;
      return rest;
    });
  };

  const uploadFile = async (
    e: React.ChangeEvent<HTMLInputElement>,
    linkId: string,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setChangingFile(true);
    const validTypes = ["image/jpeg", "image/png", "image/svg+xml"];
    const maxSizeInBytes = 5 * 1024 * 1024;

    if (!validTypes.includes(file.type)) {
      toast.error("Invalid file type. Only JPG, PNG, and SVG are allowed.");
      if (e.target) {
        e.target.value = "";
      }
      setChangingFile(false);
      return;
    }

    if (file.size > maxSizeInBytes) {
      toast.error("File is too large. Must be under 5MB.");
      if (e.target) {
        e.target.value = "";
      }
      setChangingFile(false);
      return;
    }

    const uploadPromise = uploadImage(file);

    toast.promise(uploadPromise, {
      loading: "Uploading image...",
      success: "Image uploaded",
      error: "Failed to upload image",
    });

    const { success, url } = await uploadPromise;

    if (success && url) {
      setEditingLinks((prev) => ({
        ...prev,
        [linkId]: {
          ...prev[linkId],
          image: url as string,
        },
      }));
    }

    if (e.target) {
      e.target.value = "";
    }
    setChangingFile(false);
  };

  const removeFile = async (linkId: string, imageUrl: string) => {
    setChangingFile(true);
    const deletePromise = deletePicture(imageUrl);

    toast.promise(deletePromise, {
      loading: "Removing image...",
      success: "Image removed",
      error: "Failed to remove image",
    });

    const { success } = await deletePromise;

    if (success) {
      setEditingLinks((prev) => ({
        ...prev,
        [linkId]: {
          ...prev[linkId],
          image: "",
        },
      }));
    }
    setChangingFile(false);
  };

  const handleRemoveLink = async (linkId: string) => {
    const result = await removeLinkFromBio({ slug, linkId });

    if (result.success) {
      setLinks((prev) => prev.filter((link) => link._id !== linkId));
      toast.success("Link removed from bio page");
    } else {
      toast.error("Failed to remove link");
    }

    setLinkToDelete(null);
  };

  const handleReorder = async (newOrder: LinkData[]) => {
    const oldOrder = [...links];
    setLinks(newOrder);

    const result = await reorderBioLinks({
      slug,
      linkIds: newOrder.map((link) => link._id),
    });

    if (!result.success) {
      toast.error("Failed to reorder links");
      setLinks(oldOrder);
    }
  };

  const handleSort = (sortType: "addedAt" | "createdAt") => {
    const sorted = [...links].sort((a, b) => {
      if (sortType === "addedAt") {
        return new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime();
      } else {
        return (
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
      }
    });
    setLinks(sorted);
    toast.success(
      `Sorted by ${sortType === "addedAt" ? "date added" : "date created"}`,
    );
  };

  return (
    <main className="flex flex-col items-center w-full mx-auto gap-4 bg-accent px-4 sm:pt-14 pt-6 pb-16">
      <div className="w-full max-w-4xl flex flex-col gap-4">
        <div className="flex items-center justify-between gap-2">
          <Link
            href="/dashboard/pages"
            className="flex items-center gap-1 text-sm font-medium hover:underline"
          >
            <ChevronLeft className="h-4 w-4" />
            Back to list
          </Link>
          <Button variant="outline" asChild>
            <Link href={`/dashboard/pages/${slug}/customize`}>
              <Palette /> Customize
            </Link>
          </Button>
        </div>
        <div className="flex sm:flex-row flex-col sm:items-center items-start justify-between gap-4">
          <h1 className="text-3xl font-bold">Manage Links</h1>
          <div className="flex items-center gap-2 flex-wrap">
            <Label className="text-nowrap">Sort by:</Label>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleSort("addedAt")}
            >
              <CalendarPlus className="h-4 w-4 mr-2" />
              Date Added
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleSort("createdAt")}
            >
              <Calendar className="h-4 w-4 mr-2" />
              Date Created
            </Button>
          </div>
        </div>
        <Separator />

        {links.length === 0 ? (
          <p className="text-muted-foreground">
            No links added to this bio page yet.
          </p>
        ) : (
          <Sortable
            value={links}
            onValueChange={handleReorder}
            getItemValue={(link) => link._id}
          >
            <SortableContent className="flex flex-col gap-4">
              {links.map((link) => {
                const currentTitle =
                  editingLinks[link._id]?.title ?? link.customTitle ?? "";
                const currentImage =
                  editingLinks[link._id]?.image !== undefined
                    ? editingLinks[link._id]?.image
                    : link.image;
                const isChanged = hasChanges(link._id);
                const isSaving = savingLinks[link._id];

                return (
                  <SortableItem key={link._id} value={link._id} asChild>
                    <Card className="p-4">
                      <div className="flex flex-col gap-4">
                        <div className="flex items-start gap-2 sm:gap-4">
                          <SortableItemHandle>
                            <div className="cursor-grab active:cursor-grabbing p-2 hover:bg-accent rounded-md transition-colors">
                              <GripVertical className="h-5 w-5" />
                            </div>
                          </SortableItemHandle>

                          <div className="flex-1 min-w-0 flex flex-col gap-4">
                            <div className="flex flex-col gap-2">
                              <Label htmlFor={`title-${link._id}`}>Title</Label>
                              <Input
                                id={`title-${link._id}`}
                                value={currentTitle}
                                onChange={(e) =>
                                  handleTitleChange(link._id, e.target.value)
                                }
                                placeholder={link.title}
                                className="w-full"
                              />
                            </div>

                            <div className="flex flex-col gap-2">
                              <Label>Image</Label>
                              <div className="flex items-center gap-2 flex-wrap">
                                {currentImage ? (
                                  <>
                                    <Avatar className="h-16 w-16 rounded-md shrink-0">
                                      <AvatarImage
                                        src={currentImage}
                                        alt="Link image"
                                        className=" object-cover"
                                      />
                                      <AvatarFallback>
                                        <ImageIcon className="h-8 w-8" />
                                      </AvatarFallback>
                                    </Avatar>
                                    <Button
                                      variant="destructive"
                                      size="sm"
                                      onClick={() =>
                                        removeFile(link._id, currentImage)
                                      }
                                    >
                                      <Trash2 className="h-4 w-4 mr-2" />
                                      Remove
                                    </Button>
                                  </>
                                ) : (
                                  <>
                                    <Input
                                      disabled={changingFiles}
                                      type="file"
                                      accept="image/jpeg,image/png,image/svg+xml"
                                      className="w-full"
                                      ref={(el) => {
                                        fileInputRefs.current[link._id] = el;
                                      }}
                                      onChange={(e) => uploadFile(e, link._id)}
                                    />
                                  </>
                                )}
                              </div>
                            </div>

                            <TooltipProvider>
                              <div className="flex items-center gap-3 text-sm text-muted-foreground flex-wrap">
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <div className="flex items-center gap-1">
                                      <LinkIcon className="h-3.5 w-3.5" />
                                      <span className="truncate max-w-[120px]">
                                        {link.shortUrl}
                                      </span>
                                    </div>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>Short URL: {link.shortUrl}</p>
                                  </TooltipContent>
                                </Tooltip>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <div className="flex items-center gap-1">
                                      <Calendar className="h-3.5 w-3.5" />
                                      <span>
                                        {new Date(
                                          link.createdAt,
                                        ).toLocaleDateString()}
                                      </span>
                                    </div>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>
                                      Created:{" "}
                                      {new Date(
                                        link.createdAt,
                                      ).toLocaleDateString()}
                                    </p>
                                  </TooltipContent>
                                </Tooltip>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <div className="flex items-center gap-1">
                                      <CalendarPlus className="h-3.5 w-3.5" />
                                      <span>
                                        {new Date(
                                          link.addedAt,
                                        ).toLocaleDateString()}
                                      </span>
                                    </div>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>
                                      Added:{" "}
                                      {new Date(
                                        link.addedAt,
                                      ).toLocaleDateString()}
                                    </p>
                                  </TooltipContent>
                                </Tooltip>
                              </div>
                            </TooltipProvider>

                            {isChanged && (
                              <div className="flex gap-2 flex-wrap">
                                <Button
                                  size="sm"
                                  onClick={() => handleSaveChanges(link._id)}
                                  disabled={isSaving}
                                >
                                  {isSaving ? (
                                    <>
                                      <Spinner className="h-3 w-3 mr-2" />
                                      Saving...
                                    </>
                                  ) : (
                                    "Save Changes"
                                  )}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleDiscardChanges(link._id)}
                                  disabled={isSaving}
                                >
                                  Discard
                                </Button>
                              </div>
                            )}
                          </div>
                          <div className="flex flex-col gap-2">
                            <Button asChild variant={"secondary"} size={"icon"}>
                              <Link
                                href={`/dashboard/links/${link.shortUrl.split("/")[link.shortUrl.split("/").length - 1]}/details`}
                              >
                                <ChartColumnIncreasing className="h-4 w-4" />
                              </Link>
                            </Button>
                            <Button
                              variant={"destructive"}
                              size={"icon"}
                              onClick={() => setLinkToDelete(link._id)}
                            >
                              <Trash2 />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </Card>
                  </SortableItem>
                );
              })}
            </SortableContent>
          </Sortable>
        )}
      </div>

      <AlertDialog
        open={!!linkToDelete}
        onOpenChange={() => setLinkToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Link</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove this link from your bio page? This
              action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => linkToDelete && handleRemoveLink(linkToDelete)}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
};
