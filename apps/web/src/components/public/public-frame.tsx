import { buttonVariants, cn, ShortnMark } from "@shortn/ui";
import type { ReactNode } from "react";

const htmlLang = { en: "en", pt: "pt-PT", es: "es" } as const;

/**
 * Pages visitors reach from a short link (12 "Public pages"): brand mark,
 * one message, one action. Server-rendered and usable without JavaScript;
 * served on shortn.at through the edge Worker as well as on the app host.
 */
export function PublicFrame({
  locale,
  brand,
  children,
}: {
  /** The page's own locale, which may differ from the document's. */
  locale: keyof typeof htmlLang;
  brand: string;
  children: ReactNode;
}) {
  return (
    <div lang={htmlLang[locale]} className="flex min-h-dvh flex-col">
      <main className="flex flex-1 justify-center px-4 pt-[max(2.5rem,12vh)] pb-16">
        <div className="flex w-full max-w-[440px] flex-col">
          <div className="mb-10 flex items-center gap-2.5">
            <ShortnMark size={24} />
            <span className="text-emphasis font-semibold tracking-[-0.01em]">
              {brand}
            </span>
          </div>
          {children}
        </div>
      </main>
    </div>
  );
}

export function PublicHeading({
  title,
  description,
}: {
  title: ReactNode;
  description?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-2">
      <h1 className="text-title font-semibold tracking-[-0.015em] text-balance">
        {title}
      </h1>
      {description ? (
        <p className="text-body text-pretty text-fg-muted">{description}</p>
      ) : null}
    </div>
  );
}

/** A message-only page (not found, disabled) with its single way out. */
export function PublicMessage({
  title,
  description,
  action,
}: {
  title: ReactNode;
  description: ReactNode;
  action: { href: string; label: string };
}) {
  return (
    <>
      <PublicHeading title={title} description={description} />
      <a
        href={action.href}
        className={cn(buttonVariants({ size: "lg" }), "self-start")}
      >
        {action.label}
      </a>
    </>
  );
}
