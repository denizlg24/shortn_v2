import { buttonVariants, cn } from "@shortn/ui";
import { ArrowRight, Check } from "lucide-react";
import type { ReactNode } from "react";

export function Container({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn("mx-auto w-full max-w-[1200px] px-4 md:px-6", className)}
    >
      {children}
    </div>
  );
}

/** The navy page head every marketing page opens with. */
export function PageHead({
  title,
  intro,
  children,
}: {
  title: ReactNode;
  intro?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <section className="band">
      <Container className="pt-14 pb-16 md:pt-20 md:pb-24">
        <h1 className="max-w-[20ch] font-display text-display font-extrabold tracking-[-0.035em] text-balance">
          {title}
        </h1>
        {intro ? (
          <p className="mt-6 max-w-[56ch] text-lede text-pretty text-fg-muted">
            {intro}
          </p>
        ) : null}
        {children}
      </Container>
    </section>
  );
}

export function SectionHeading({
  id,
  title,
  body,
  className,
}: {
  id?: string;
  title: ReactNode;
  body?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex max-w-[40rem] flex-col gap-4", className)}>
      <h2
        id={id}
        className="scroll-mt-24 font-display text-headline font-extrabold tracking-[-0.03em] text-balance"
      >
        {title}
      </h2>
      {body ? (
        <p className="text-lede text-pretty text-fg-muted">{body}</p>
      ) : null}
    </div>
  );
}

export function Points({
  items,
  className,
}: {
  items: ReactNode[];
  className?: string;
}) {
  return (
    <ul className={cn("flex flex-col border-t border-line", className)}>
      {items.map((item, index) => (
        <li
          key={index}
          className="flex gap-3 border-b border-line py-3 text-emphasis text-pretty"
        >
          <Check className="mt-1 size-4 shrink-0 text-fg-muted" aria-hidden />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

type Action = { href: string; label: string };

/** The navy close every long page ends on. */
export function ClosingBand({
  title,
  body,
  primary,
  secondary,
}: {
  title: ReactNode;
  body: ReactNode;
  primary: Action;
  secondary: Action;
}) {
  return (
    <section className="band">
      <Container className="flex flex-col items-start gap-8 py-20 md:py-28">
        <h2 className="max-w-[18ch] font-display text-display font-extrabold tracking-[-0.035em] text-balance">
          {title}
        </h2>
        <p className="max-w-[48ch] text-lede text-pretty text-fg-muted">
          {body}
        </p>
        <div className="flex flex-wrap gap-2">
          <a
            href={primary.href}
            className={cn(
              buttonVariants({ variant: "primary", size: "lg" }),
              "h-12 px-5 text-emphasis",
            )}
          >
            {primary.label}
            <ArrowRight />
          </a>
          <a
            href={secondary.href}
            className={cn(
              buttonVariants({ size: "lg" }),
              "h-12 px-5 text-emphasis",
            )}
          >
            {secondary.label}
          </a>
        </div>
      </Container>
    </section>
  );
}
