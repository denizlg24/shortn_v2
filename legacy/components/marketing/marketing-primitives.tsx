import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { ArrowRight } from "lucide-react";
import * as React from "react";

export function MarketingPage({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <main
      className={cn(
        "relative mx-auto flex w-full max-w-[72rem] flex-col gap-20 px-4 pb-24 pt-6 sm:px-6 lg:gap-28 lg:px-8 lg:pt-10",
        className,
      )}
    >
      {children}
    </main>
  );
}

export function MarketingHero({
  title,
  subtitle,
  actions,
  aside,
  className,
  titleClassName,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  aside?: React.ReactNode;
  className?: string;
  titleClassName?: string;
}) {
  return (
    <section className={cn("relative py-8 sm:py-12 lg:py-14", className)}>
      <div className="mx-auto flex max-w-4xl flex-col items-center text-center">
        <h1
          className={cn(
            "max-w-4xl font-[family-name:var(--font-editorial)] text-5xl font-semibold leading-[0.95] tracking-[-0.06em] text-balance sm:text-6xl lg:text-[5.5rem]",
            titleClassName,
          )}
        >
          {title}
        </h1>
        {subtitle ? (
          <div className="mt-6 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
            {subtitle}
          </div>
        ) : null}
        {actions ? (
          <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:flex-wrap sm:justify-center">
            {actions}
          </div>
        ) : null}
      </div>
      {aside ? (
        <div className="mx-auto mt-12 w-full max-w-5xl">{aside}</div>
      ) : null}
    </section>
  );
}

export function MarketingSection({
  eyebrow,
  title,
  description,
  children,
  className,
}: {
  eyebrow?: React.ReactNode;
  title?: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("space-y-10", className)}>
      {eyebrow || title || description ? (
        <header className="mx-auto flex max-w-3xl flex-col items-center gap-5 text-center">
          <div>
            {eyebrow ? (
              <p className="mb-3 text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                {eyebrow}
              </p>
            ) : null}
            {title ? (
              <h2 className="font-[family-name:var(--font-editorial)] text-4xl font-semibold leading-[0.98] tracking-[-0.05em] text-balance sm:text-5xl">
                {title}
              </h2>
            ) : null}
          </div>
          {description ? (
            <div className="max-w-2xl text-sm leading-7 text-muted-foreground sm:text-base">
              {description}
            </div>
          ) : null}
        </header>
      ) : null}
      {children}
    </section>
  );
}

export function MarketingStatStrip({
  items,
  className,
}: {
  items: Array<{ value: React.ReactNode; label: React.ReactNode }>;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "grid gap-6 border-y border-black/5 py-8 sm:grid-cols-2 lg:grid-cols-4",
        className,
      )}
    >
      {items.map((item) => (
        <div
          key={String(item.label)}
          className="border-t border-black/5 pt-4 text-left first:border-t-0 first:pt-0 sm:first:border-t sm:first:pt-4 lg:border-t-0 lg:border-l lg:pl-6 lg:first:border-l-0 lg:first:pl-0"
        >
          <p className="font-[family-name:var(--font-editorial)] text-4xl font-semibold leading-none tracking-[-0.05em] sm:text-5xl">
            {item.value}
          </p>
          <p className="mt-3 text-sm uppercase tracking-[0.2em] text-muted-foreground">
            {item.label}
          </p>
        </div>
      ))}
    </section>
  );
}

export function MarketingFeatureGrid({
  items,
  className,
}: {
  items: Array<{
    title: React.ReactNode;
    description: React.ReactNode;
    icon?: React.ReactNode;
  }>;
  className?: string;
}) {
  return (
    <div className={cn("grid gap-10 md:grid-cols-2 xl:grid-cols-3", className)}>
      {items.map((item, index) => (
        <article
          key={String(item.title)}
          className="relative flex h-full flex-col gap-5 pl-8"
        >
          <span className="absolute left-0 top-1 h-14 w-px bg-primary/20" />
          <div className="flex items-center justify-between gap-4">
            <span className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
              {String(index + 1).padStart(2, "0")}
            </span>
            {item.icon ? (
              <span className="text-primary/70">{item.icon}</span>
            ) : null}
          </div>
          <h3 className="font-[family-name:var(--font-editorial)] text-3xl font-semibold leading-[0.98] tracking-[-0.045em]">
            {item.title}
          </h3>
          <p className="max-w-sm text-sm leading-7 text-muted-foreground sm:text-base">
            {item.description}
          </p>
        </article>
      ))}
    </div>
  );
}

export function MarketingQuoteStrip({
  quotes,
  className,
}: {
  quotes: React.ReactNode[];
  className?: string;
}) {
  return (
    <div className={cn("grid gap-8 lg:grid-cols-3", className)}>
      {quotes.map((quote, index) => (
        <blockquote
          key={index}
          className="flex h-full flex-col gap-6 rounded-[1.75rem] bg-white/65 px-6 py-6 shadow-[0_24px_80px_-42px_rgba(15,23,42,0.35)] ring-1 ring-black/5 backdrop-blur-sm"
        >
          <span className="font-[family-name:var(--font-editorial)] text-5xl font-semibold leading-none text-primary/30">
            &ldquo;
          </span>
          <p className="text-sm leading-7 text-muted-foreground sm:text-base">
            {quote}
          </p>
        </blockquote>
      ))}
    </div>
  );
}

export function MarketingCtaBand({
  title,
  subtitle,
  actions,
  className,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  actions: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "backdrop-blur-sm flex flex-col items-center gap-y-4",
        className,
      )}
    >
      <div className="absolute -right-20 top-1/2 h-52 w-52 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(36,75,138,0.16),transparent_70%)] blur-3xl" />
      <div className="w-full flex flex-col items-center text-center">
        <h2 className="font-[family-name:var(--font-editorial)] text-4xl font-semibold leading-[0.98] tracking-[-0.05em] text-balance sm:text-5xl">
          {title}
        </h2>
        {subtitle ? (
          <p className="mt-4 max-w-2xl text-sm leading-7 text-muted-foreground sm:text-base">
            {subtitle}
          </p>
        ) : null}
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        {actions}
      </div>
    </section>
  );
}

export function PrimaryActionLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Button
      asChild
      size="lg"
      className="rounded-full px-6 shadow-[0_18px_50px_-24px_rgba(15,23,42,0.55)]"
    >
      <Link href={href}>
        {children}
        <ArrowRight />
      </Link>
    </Button>
  );
}

export function SecondaryActionLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Button
      asChild
      size="lg"
      variant="outline"
      className="rounded-full border-black/10 bg-white/70 px-6 shadow-[0_18px_50px_-28px_rgba(15,23,42,0.24)] backdrop-blur-sm"
    >
      <Link href={href}>{children}</Link>
    </Button>
  );
}
