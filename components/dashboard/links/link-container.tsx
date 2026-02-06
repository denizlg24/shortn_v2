"use client";

import { PaginationControls } from "@/components/ui/pagination-controls";
import { useRouter } from "@/i18n/navigation";
import { TUrl } from "@/models/url/UrlV3";
import { LinkCard } from "./link-card";
import { cn, fetchApi } from "@/lib/utils";
import { useEffect, useState } from "react";
import { ITag } from "@/models/url/Tag";
import { useTranslations } from "next-intl";

export const LinkContainer = ({
  links,
  total,
  tags,
  page,
  limit,
  hideEndTag,
}: {
  links: (TUrl & { bioPageSlug?: string })[];
  total: number;
  tags: string[];
  page: number;
  limit: number;
  hideEndTag?: boolean;
}) => {
  const t = useTranslations("link-container");
  const router = useRouter();
  const [tagOptions, setTagOptions] = useState<ITag[]>([]);
  const [tagSearchInput, setTagSearchInput] = useState("");

  useEffect(() => {
    const delayDebounce = setTimeout(() => {
      if (tagSearchInput.trim() === "") {
        fetchApi<{ tags: ITag[] }>("tags").then((res) => {
          if (res.success) {
            setTagOptions(res.tags);
          } else {
            setTagOptions([]);
          }
        });
        return;
      }
      fetchApi<{ tags: ITag[] }>(`tags?q=${tagSearchInput}`).then((res) => {
        if (res.success) {
          setTagOptions(res.tags);
        } else {
          setTagOptions([]);
        }
      });
    }, 300);

    return () => clearTimeout(delayDebounce);
  }, [tagSearchInput]);

  const addTag = (tagId: string) => {
    const searchParams = new URLSearchParams(window.location.search);
    const currentTags = searchParams.get("tags");
    let tagIds: string[] = [];

    try {
      tagIds = currentTags ? JSON.parse(currentTags) : [];
    } catch {
      tagIds = [];
    }

    if (!tagIds.includes(tagId)) {
      tagIds.push(tagId);
    }

    searchParams.set("tags", JSON.stringify(tagIds));

    router.push(`?${searchParams.toString()}`);
  };

  const removeTag = (tagId: string) => {
    const searchParams = new URLSearchParams(window.location.search);
    const currentTags = searchParams.get("tags");
    let tagIds: string[] = [];

    try {
      tagIds = currentTags ? JSON.parse(currentTags) : [];
    } catch {
      tagIds = [];
    }

    tagIds = tagIds.filter((id) => id !== tagId);

    if (tagIds.length > 0) {
      searchParams.set("tags", JSON.stringify(tagIds));
    } else {
      searchParams.delete("tags");
    }

    router.push(`?${searchParams.toString()}`);
  };

  return (
    <div
      className={cn(
        "w-full col-span-full flex flex-col gap-4",
        hideEndTag ? "pb-0!" : "pb-6!",
      )}
    >
      {links.length > 0 ? (
        <>
          {links.map((link) => (
            <LinkCard
              tags={tags}
              addTag={addTag}
              removeTag={removeTag}
              key={link._id as string}
              link={link}
              initialBioPageSlug={link.bioPageSlug}
              tagOptions={tagOptions}
              onTagSearchChange={setTagSearchInput}
            />
          ))}
          {page >= Math.ceil(total / limit) &&
            (hideEndTag ? (
              <></>
            ) : (
              <div className="w-full max-w-3xl flex flex-row items-center gap-4 mx-auto">
                <div className="h-1 grow w-[45%] bg-muted-foreground"></div>
                <p className="text-muted-foreground grow font-semibold w-full text-center">
                  {t("end-of-links")}
                </p>
                <div className="h-1 grow w-[45%] bg-muted-foreground"></div>
              </div>
            ))}
        </>
      ) : hideEndTag ? (
        <></>
      ) : (
        <div className="w-full max-w-3xl flex flex-row items-center gap-4 mx-auto">
          <div className="h-1 grow w-[45%] bg-muted-foreground"></div>
          <p className="text-muted-foreground font-semibold w-full text-center">
            {t("end-of-links")}
          </p>
          <div className="h-1 grow w-[45%] bg-muted-foreground"></div>
        </div>
      )}
      {Math.ceil(total / limit) > 1 && (
        <PaginationControls totalPages={Math.ceil(total / limit)} />
      )}
    </div>
  );
};
