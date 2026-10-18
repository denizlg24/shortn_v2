"use client";
import { useState } from "react";
import type { BioLinkItem, BioResolvedLink } from "@shortn/core/bio-content";
import { safeBioUrl } from "@shortn/core/bio-urls";

export function BioLinkButton({
  item,
  resolved,
  preview,
  cardStyle = "list",
  cardContent = "image-text",
  cardRadius = "theme",
  imageFit = "cover",
  linkSurface = "theme",
  linkBorder = "theme",
  linkWeight = "theme",
  linkSpacing = "comfortable",
  showLinkArrow = true,
}: {
  linkSurface?: string;
  linkBorder?: string;
  linkWeight?: string;
  linkSpacing?: string;
  showLinkArrow?: boolean;
  cardStyle?: string;
  cardContent?: string;
  cardRadius?: string;
  imageFit?: string;
  item: BioLinkItem;
  resolved?: BioResolvedLink | undefined;
  preview: boolean;
}) {
  if (!resolved || !safeBioUrl(resolved.href)) return null;
  const href = new URL(resolved.href);
  href.searchParams.set("block", item.id);
  const image = cardContent !== "text" ? safeBioUrl(item.image) : undefined;
  return (
    <a
      aria-label={item.title || resolved.title}
      title={item.title || resolved.title}
      data-surface={linkSurface}
      data-border={linkBorder}
      data-weight={linkWeight}
      data-spacing={linkSpacing}
      data-content={image ? cardContent : "text"}
      data-radius={cardRadius}
      data-image-fit={imageFit}
      className={`bio-link bio-card-${cardStyle}${item.highlight ? " bio-link-highlight" : ""}`}
      data-block-id={item.id}
      href={preview ? undefined : href.href}
      tabIndex={preview ? -1 : undefined}
      rel="ugc noopener noreferrer"
    >
      {image ? (
        <img src={image} width={48} height={48} alt="" loading="lazy" />
      ) : null}
      <span>{item.title || resolved.title}</span>
      {showLinkArrow ? (
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          width="18"
          height="18"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <path d="M5 12h14m-6-6 6 6-6 6" />
        </svg>
      ) : null}
    </a>
  );
}
export function PaginatedBioLinks({
  items,
  links,
  pageSize,
  preview,
  locale,
  cardStyle,
  cardContent,
  cardRadius,
  imageFit,
  paginationStyle = "arrows",
  showPageCount = true,
  linkSurface = "theme",
  linkBorder = "theme",
  linkWeight = "theme",
  linkSpacing = "comfortable",
  showLinkArrow = true,
  paginationAppearance = "muted",
  paginationSize = "small",
}: {
  items: BioLinkItem[];
  links: Record<string, BioResolvedLink>;
  pageSize: number;
  preview: boolean;
  locale: "en" | "pt" | "es";
  cardStyle: string;
  cardContent: string;
  cardRadius: string;
  imageFit: string;
  paginationStyle: "arrows" | "labels";
  showPageCount: boolean;
  linkSurface: string;
  linkBorder: string;
  linkWeight: string;
  linkSpacing: string;
  showLinkArrow: boolean;
  paginationAppearance: string;
  paginationSize: string;
}) {
  const [page, setPage] = useState(0);
  const pages = Math.max(1, Math.ceil(items.length / pageSize)),
    current = Math.min(page, pages - 1);
  const labels = {
    en: ["Previous links", "Next links", "Page"],
    pt: ["Links anteriores", "Próximos links", "Página"],
    es: ["Enlaces anteriores", "Siguientes enlaces", "Página"],
  }[locale];
  return (
    <>
      <div
        className="bio-link-list"
        data-layout={cardStyle}
        data-spacing={linkSpacing}
      >
        {items
          .slice(current * pageSize, (current + 1) * pageSize)
          .map((item) => (
            <BioLinkButton
              key={item.id}
              item={item}
              resolved={links[item.linkId]}
              preview={preview}
              cardStyle={cardStyle}
              cardContent={cardContent}
              cardRadius={cardRadius}
              imageFit={imageFit}
              linkSurface={linkSurface}
              linkBorder={linkBorder}
              linkWeight={linkWeight}
              linkSpacing={linkSpacing}
              showLinkArrow={showLinkArrow}
            />
          ))}
      </div>
      {pages > 1 ? (
        <nav
          className="bio-pagination"
          data-appearance={paginationAppearance}
          data-size={paginationSize}
          aria-label={labels[2]}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            aria-label={labels[0]}
            disabled={current === 0}
            onClick={() => setPage(current - 1)}
          >
            {paginationStyle === "labels" ? (
              labels[0]
            ) : (
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                width="18"
                height="18"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <path d="m14 6-6 6 6 6" />
              </svg>
            )}
          </button>
          {showPageCount ? (
            <span role="status">
              {current + 1} / {pages}
            </span>
          ) : (
            <span className="bio-sr-only" role="status">
              {labels[2]} {current + 1}
            </span>
          )}
          <button
            type="button"
            aria-label={labels[1]}
            disabled={current === pages - 1}
            onClick={() => setPage(current + 1)}
          >
            {paginationStyle === "labels" ? (
              labels[1]
            ) : (
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                width="18"
                height="18"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <path d="m10 6 6 6-6 6" />
              </svg>
            )}
          </button>
        </nav>
      ) : null}
    </>
  );
}
