import type { ReactNode } from "react";
import { tourAnchor, type TourAnchor } from "@/lib/tour/anchors";
import { TabNav, type Tab } from "./tab-nav";
import { TopBar, type Crumb } from "./top-bar";

// Every dashboard page: breadcrumb bar, heading with its primary action,
// optional tab pages, then content (17 §Navigation conventions).
export function Page({
  crumbs,
  title,
  description,
  actions,
  tabs,
  tabsLabel,
  tabsAnchor,
  width = "wide",
  children,
}: {
  crumbs: Crumb[];
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  tabs?: Tab[];
  tabsLabel?: string;
  tabsAnchor?: TourAnchor;
  width?: "wide" | "form";
  children: ReactNode;
}) {
  return (
    <>
      <TopBar crumbs={crumbs} />
      <div className="border-b border-line px-gutter pt-6">
        <div className="flex flex-wrap items-start justify-between gap-4 pb-5">
          <div className="min-w-0">
            <h1 className="text-title font-semibold tracking-[-0.015em] break-words">
              {title}
            </h1>
            {description ? (
              <p className="mt-1 max-w-2xl text-small text-fg-muted">
                {description}
              </p>
            ) : null}
          </div>
          {actions ? (
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              {actions}
            </div>
          ) : null}
        </div>
        {tabs ? (
          <TabNav
            tabs={tabs}
            label={tabsLabel ?? ""}
            {...(tabsAnchor ? { anchor: tabsAnchor } : {})}
          />
        ) : null}
      </div>
      <div className="flex-1 px-gutter pt-6 pb-16">
        <div className={width === "form" ? "max-w-[560px]" : ""}>
          {children}
        </div>
      </div>
    </>
  );
}

// A titled group inside a page or form, separated by space and a hairline.
export function Section({
  title,
  description,
  aside,
  anchor,
  children,
}: {
  title: ReactNode;
  description?: ReactNode;
  aside?: ReactNode;
  anchor?: TourAnchor;
  children: ReactNode;
}) {
  return (
    <section
      {...(anchor ? tourAnchor(anchor) : {})}
      className="border-b border-line py-6 first:pt-0 last:border-b-0"
    >
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-body font-semibold">{title}</h2>
          {description ? (
            <p className="mt-1 text-small text-fg-muted">{description}</p>
          ) : null}
        </div>
        {aside}
      </div>
      {children}
    </section>
  );
}
