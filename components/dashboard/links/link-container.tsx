"use client";

import { PaginationControls } from "@/components/ui/pagination-controls";
import { usePathname, useRouter } from "@/i18n/navigation";
import { IUrl } from "@/models/url/UrlV3";
import { useUser } from "@/utils/UserContext";
import { Loader2 } from "lucide-react";
import { User } from "next-auth";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { LinkCard } from "./link-card";
import { parse } from "date-fns";
import { getFilteredLinks } from "@/app/actions/linkActions";

interface IFilters {
  tags: string[];
  customLink: "all" | "on" | "off";
  attachedQR: "all" | "on" | "off";
  sortBy: "date_asc" | "date_desc" | "clicks_asc" | "clicks_desc";
  query: string;
  page: number;
  limit: number;
  startDate?: Date;
  endDate?: Date;
}

export const LinkContainer = () => {
  const router = useRouter();
  const [links, setLinks] = useState<IUrl[]>([]);
  const [linksLoading, setLinksLoading] = useState(true);
  const [filtersReady, setFiltersReady] = useState(false);
  const [filters, setFilters] = useState<IFilters>({
    tags: [],
    customLink: "all",
    attachedQR: "all",
    sortBy: "date_asc",
    query: "",
    page: 1,
    limit: 10,
  });
  const [total, setTotal] = useState(0);
  const session = useUser();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const getLinksWrapper = async (filters: IFilters, user: User) => {
    try {
      const { links, total } = await getFilteredLinks(filters, user.sub);
      setLinks(links);
      setTotal(total);
    } catch (err) {
      console.error("Failed to load links:", err);
    }
    setLinksLoading(false);
  };

  function parseToUTC(dateStr: string): Date {
    const parsed = parse(dateStr, "MM-dd-yyyy", new Date());
    return new Date(
      Date.UTC(parsed.getFullYear(), parsed.getMonth(), parsed.getDate())
    );
  }

  useEffect(() => {
    setFiltersReady(false);
    const params = new URLSearchParams(searchParams.toString());
    setLinksLoading(true);
    setLinks([]);
    let tagIds: string[] = [];
    const tagsParam = params.get("tags");
    if (tagsParam) {
      try {
        tagIds = JSON.parse(tagsParam);
      } catch (err) {
        console.error("Invalid tag param:", err);
      }
    }

    const dateParsed = {
      from: searchParams.get("startDate")
        ? parseToUTC(searchParams.get("startDate")!)
        : undefined,
      to: searchParams.get("endDate")
        ? parseToUTC(searchParams.get("endDate")!)
        : undefined,
    };
    const newFilters: IFilters = {
      tags: tagIds,
      customLink: (params.get("customLink") as IFilters["customLink"]) || "all",
      attachedQR: (params.get("attachedQR") as IFilters["attachedQR"]) || "all",
      sortBy: (params.get("sortBy") as IFilters["sortBy"]) || "date_desc",
      query: params.get("query") || "",
      page: parseInt(params.get("page") || "1", 10),
      limit: parseInt(params.get("limit") || "10", 10),
      startDate: dateParsed.from || undefined,
      endDate: dateParsed.to || undefined,
    };
    setFilters(newFilters);
    setFiltersReady(true);
  }, [pathname, searchParams.toString()]);

  useEffect(() => {
    if (!filtersReady || !session.user) {
      return;
    }
    getLinksWrapper(filters, session.user);
  }, [filtersReady, session, filters]);

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
    <div className="w-full col-span-full flex flex-col gap-4">
      {linksLoading ? (
        <div className="w-full flex flex-row items-center justify-start font-semibold md:text-base text-sm gap-1">
          <Loader2 className="animate-spin h-4 w-4 aspect-square" />
          <p>Loading links...</p>
        </div>
      ) : links.length > 0 ? (
        <>
          {/* Render links */}
          {links.map((link) => (
            <LinkCard
              tags={filters.tags}
              addTag={addTag}
              removeTag={removeTag}
              key={link._id as string}
              link={link}
            />
          ))}

          {Math.ceil(total / parseInt(searchParams.get("limit") || "10", 10)) >
            1 && (
            <PaginationControls
              totalPages={Math.ceil(
                total / parseInt(searchParams.get("limit") || "10", 10)
              )}
            />
          )}
          {parseInt(searchParams.get("page") || "1", 10) >=
            Math.ceil(
              total / parseInt(searchParams.get("limit") || "10", 10)
            ) && (
            <div className="w-full max-w-3xl flex flex-row items-center gap-4 mx-auto">
              <div className="h-1 grow w-[45%] bg-muted-foreground"></div>
              <p className="text-muted-foreground grow font-semibold w-full text-center">
                You've reached the end of your links
              </p>
              <div className="h-1 grow w-[45%] bg-muted-foreground"></div>
            </div>
          )}
        </>
      ) : (
        <div className="w-full max-w-3xl flex flex-row items-center gap-4 mx-auto">
          <div className="h-1 grow w-[45%] bg-muted-foreground"></div>
          <p className="text-muted-foreground font-semibold w-full text-center">
            You've reached the end of your links
          </p>
          <div className="h-1 grow w-[45%] bg-muted-foreground"></div>
        </div>
      )}
    </div>
  );
};
