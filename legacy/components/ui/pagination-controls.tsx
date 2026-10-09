"use client";

import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { cn } from "@/lib/utils";
import { useSearchParams } from "next/navigation";

type PaginationControlsProps = {
  className?: string;
  totalPages: number;
};

export function PaginationControls({
  className,
  totalPages,
}: PaginationControlsProps) {
  const searchParams = useSearchParams();
  const currentPage = parseInt(searchParams.get("page") || "1");

  const buildPageHref = (page: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", page.toString());
    return `?${params.toString()}`;
  };

  const getPageNumbers = () => {
    const delta = 1;
    const range = [];

    for (
      let i = Math.max(1, currentPage - delta);
      i <= Math.min(totalPages, currentPage + delta);
      i++
    ) {
      range.push(i);
    }

    return range;
  };

  return (
    <Pagination className={className}>
      <PaginationContent>
        <PaginationItem>
          <PaginationPrevious
            className={cn(
              currentPage > 1
                ? "text-foreground"
                : "text-muted-foreground/50 hover:text-muted-foreground/50 hover:bg-background"
            )}
            href={buildPageHref(Math.max(1, currentPage - 1))}
          />
        </PaginationItem>

        {currentPage > 2 && (
          <>
            <PaginationItem>
              <PaginationLink href={buildPageHref(1)}>1</PaginationLink>
            </PaginationItem>
            {currentPage > 3 && (
              <PaginationItem>
                <PaginationEllipsis />
              </PaginationItem>
            )}
          </>
        )}

        {getPageNumbers().map((page) => (
          <PaginationItem key={page}>
            <PaginationLink
              href={buildPageHref(page)}
              isActive={page === currentPage}
            >
              {page}
            </PaginationLink>
          </PaginationItem>
        ))}

        {currentPage < totalPages - 1 && (
          <>
            {currentPage < totalPages - 2 && (
              <PaginationItem>
                <PaginationEllipsis />
              </PaginationItem>
            )}
            <PaginationItem>
              <PaginationLink href={buildPageHref(totalPages)}>
                {totalPages}
              </PaginationLink>
            </PaginationItem>
          </>
        )}

        <PaginationItem>
          <PaginationNext
            className={cn(
              currentPage < totalPages
                ? "text-foreground"
                : "text-muted-foreground/50 hover:text-muted-foreground/50 hover:bg-background"
            )}
            href={buildPageHref(Math.min(totalPages, currentPage + 1))}
          />
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  );
}
