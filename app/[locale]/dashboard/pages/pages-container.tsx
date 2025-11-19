"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { useRouter } from "@/i18n/navigation";
import { CornerDownLeft, Loader2, Search, X } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { PageCard } from "./page-card";

export const PagesContainer = ({
  pages,
  initialQuery,
  currPage,
  total,
  limit,
}: {
  pages: {
    title: string;
    slug: string;
    createdAt: Date;
    linkCount: number;
    image?: string;
  }[];
  initialQuery: string;
  total: number;
  currPage: number;
  limit: number;
}) => {
  const router = useRouter();

  const [query, setQuery] = useState(initialQuery);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setQuery(initialQuery);
  }, [initialQuery]);

  const hasChanges = query !== initialQuery;

  const handleSearch = () => {
    startTransition(() => {
      const params = new URLSearchParams();
      if (query) {
        params.set("query", query);
      }
      router.push(`?${params.toString()}`);
    });
  };

  const clearQuery = () => {
    startTransition(() => {
      setQuery("");
      router.push("?query=");
    });
  };

  return (
    <div className="w-full flex flex-col gap-6">
      <h1 className="col-span-full lg:text-3xl md:text-2xl sm:text-xl text-lg font-bold">
        Your Pages
      </h1>
      <div className="w-full flex md:flex-row flex-col justify-start gap-2 lg:items-center items-start pb-4 border-b-2 relative col-span-full">
        <div className="relative w-full lg:max-w-[375px] md:max-w-[300px]">
          <Input
            type="text"
            name="query"
            id="query"
            placeholder="Search pages"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && hasChanges) {
                handleSearch();
              }
            }}
            className="bg-background pl-7 w-full"
          />
          <Search className="absolute left-2 top-2.5 z-10 w-4 h-4 text-gray-400" />
          {query && (
            <X
              onClick={clearQuery}
              className="absolute right-2 top-2.5 z-10 w-4 h-4 text-gray-400 hover:cursor-pointer"
            />
          )}
        </div>
        {hasChanges && (
          <Button onClick={handleSearch} disabled={isPending}>
            {isPending ? (
              <Loader2 className="animate-spin" />
            ) : (
              <CornerDownLeft />
            )}
            {isPending ? "Searching..." : "Search"}
          </Button>
        )}
      </div>
      {pages.length > 0 ? (
        <>
          {pages.map((page) => {
            return <PageCard page={page} key={page.slug} />;
          })}
          {currPage >= Math.ceil(total / limit) && (
            <div className="w-full max-w-3xl flex flex-row items-center gap-4 mx-auto">
              <div className="h-1 grow w-[45%] bg-muted-foreground"></div>
              <p className="text-muted-foreground grow font-semibold w-full text-center">
                You&apos;ve reached the end of your pages
              </p>
              <div className="h-1 grow w-[45%] bg-muted-foreground"></div>
            </div>
          )}
        </>
      ) : (
        <div className="w-full max-w-3xl flex flex-row items-center gap-4 mx-auto">
          <div className="h-1 grow w-[45%] bg-muted-foreground"></div>
          <p className="text-muted-foreground font-semibold w-full text-center">
            You&apos;ve reached the end of your pages
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
