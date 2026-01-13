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
import { useTranslations } from "next-intl";

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
  const t = useTranslations("manage-links-page");
  const [links, setLinks] = useState<LinkData[]>(initialLinks);
  const [linkToDelete, setLinkToDelete] = useState<string | null>(null);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const [editingLinks, setEditingLinks] = useState<Record<string, LinkChanges>>(
    {},
  );
  const [savingLinks, setSavingLinks] = useState<Record<string, boolean>>({});
  const [isSorting, setIsSorting] = useState(false);

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
      toast.success(t("toast.changes-saved"));
    } else {
      toast.error(t("toast.failed-save-changes"));
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
      toast.error(t("toast.invalid-file-type"));
      if (e.target) {
        e.target.value = "";
      }
      setChangingFile(false);
      return;
    }

    if (file.size > maxSizeInBytes) {
      toast.error(t("toast.file-too-large"));
      if (e.target) {
        e.target.value = "";
      }
      setChangingFile(false);
      return;
    }

    const uploadPromise = uploadImage(file);

    toast.promise(uploadPromise, {
      loading: t("toast.uploading-image"),
      success: t("toast.image-uploaded"),
      error: t("toast.failed-upload-image"),
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
      loading: t("toast.removing-image"),
      success: t("toast.image-removed"),
      error: t("toast.failed-remove-image"),
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
      toast.success(t("toast.link-removed"));
    } else {
      toast.error(t("toast.failed-remove-link"));
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
      toast.error(t("toast.failed-reorder"));
      setLinks(oldOrder);
    }
  };

  const handleSort = async (sortType: "addedAt" | "createdAt") => {
    setIsSorting(true);

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

    const result = await reorderBioLinks({
      slug,
      linkIds: sorted.map((link) => link._id),
    });

    if (result.success) {
      toast.success(
        sortType === "addedAt"
          ? t("toast.sorted-by-added")
          : t("toast.sorted-by-created"),
      );
    } else {
      toast.error(t("toast.failed-save-sorted"));

      setLinks(links);
    }

    setIsSorting(false);
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
            {t("back-to-list")}
          </Link>
          <Button variant="outline" asChild>
            <Link href={`/dashboard/pages/${slug}/customize`}>
              <Palette /> {t("customize")}
            </Link>
          </Button>
        </div>
        <div className="flex sm:flex-row flex-col sm:items-center items-start justify-between gap-4">
          <h1 className="text-3xl font-bold">{t("title")}</h1>
          <div className="flex items-center gap-2 flex-wrap">
            <Label className="text-nowrap">{t("sort-by")}</Label>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleSort("addedAt")}
              disabled={isSorting}
            >
              {isSorting ? (
                <Spinner className="h-4 w-4" />
              ) : (
                <CalendarPlus className="h-4 w-4" />
              )}
              {t("date-added")}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleSort("createdAt")}
              disabled={isSorting}
            >
              {isSorting ? (
                <Spinner className="h-4 w-4" />
              ) : (
                <Calendar className="h-4 w-4" />
              )}
              {t("date-created")}
            </Button>
          </div>
        </div>
        <Separator />

        {links.length === 0 ? (
          <p className="text-muted-foreground">{t("no-links")}</p>
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
                              <Label htmlFor={`title-${link._id}`}>
                                {t("form-title")}
                              </Label>
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
                              <Label>{t("form-image")}</Label>
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
                                      <Trash2 className="h-4 w-4" />
                                      {t("remove")}
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
                                    <p>
                                      {t("tooltip-short-url", {
                                        url: link.shortUrl,
                                      })}
                                    </p>
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
                                      {t("tooltip-created", {
                                        date: new Date(
                                          link.createdAt,
                                        ).toLocaleDateString(),
                                      })}
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
                                      {t("tooltip-added", {
                                        date: new Date(
                                          link.addedAt,
                                        ).toLocaleDateString(),
                                      })}
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
                                      <Spinner className="h-3 w-3" />
                                      {t("saving")}
                                    </>
                                  ) : (
                                    t("save-changes")
                                  )}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleDiscardChanges(link._id)}
                                  disabled={isSaving}
                                >
                                  {t("discard")}
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
            <AlertDialogTitle>{t("dialog-title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("dialog-description")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("dialog-cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => linkToDelete && handleRemoveLink(linkToDelete)}
            >
              {t("dialog-remove")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
};
