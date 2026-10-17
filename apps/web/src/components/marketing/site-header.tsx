import { buttonVariants, cn, ShortnMark } from "@shortn/ui";
import { getTranslations } from "next-intl/server";
import type { Locale } from "@/i18n/locale";
import { MobileMenu } from "./mobile-menu";

export async function SiteHeader({
  locale,
  current,
  signInHref,
  registerHref,
}: {
  locale: Locale;
  current: string;
  signInHref: string;
  registerHref: string;
}) {
  const t = await getTranslations({ locale, namespace: "marketing.nav" });
  const links = [
    { href: `/${locale}/features`, label: t("features"), page: "/features" },
    { href: `/${locale}/pricing`, label: t("pricing"), page: "/pricing" },
    { href: "/docs", label: t("docs"), page: null },
  ];
  return (
    <header className="band relative z-20">
      <a
        href="#content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-4 focus:rounded-control focus:bg-primary focus:px-3 focus:py-2 focus:text-small focus:text-primary-fg"
      >
        {t("skipToContent")}
      </a>
      <div className="mx-auto flex h-16 max-w-[1200px] items-center gap-8 px-4 md:px-6">
        <a
          href={`/${locale}`}
          aria-label={t("home")}
          className="flex items-center gap-2.5 rounded-control"
        >
          <ShortnMark size={26} className="ring-1 ring-line-strong" />
          <span className="font-display text-[1.1875rem] font-extrabold tracking-[-0.02em]">
            Shortn
          </span>
        </a>
        <nav aria-label={t("label")} className="hidden md:block">
          <ul className="flex items-center gap-1">
            {links.map((link) => (
              <li key={link.href}>
                <a
                  href={link.href}
                  aria-current={link.page === current ? "page" : undefined}
                  className="rounded-control px-3 py-2 text-body text-fg-muted transition-colors hover:text-fg aria-[current=page]:text-fg"
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <div className="ml-auto hidden items-center gap-2 md:flex">
          <a
            href={signInHref}
            className={buttonVariants({ variant: "ghost", size: "lg" })}
          >
            {t("signIn")}
          </a>
          <a
            href={registerHref}
            className={cn(buttonVariants({ variant: "primary", size: "lg" }))}
          >
            {t("getStarted")}
          </a>
        </div>
        <MobileMenu
          openLabel={t("openMenu")}
          closeLabel={t("closeMenu")}
          navLabel={t("label")}
          links={links.map(({ href, label }) => ({ href, label }))}
          signIn={{ href: signInHref, label: t("signIn") }}
          register={{ href: registerHref, label: t("getStarted") }}
        />
      </div>
    </header>
  );
}
