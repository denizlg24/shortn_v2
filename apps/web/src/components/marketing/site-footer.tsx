import { ShortnMark } from "@shortn/ui";
import { getTranslations } from "next-intl/server";
import { locales, type Locale } from "@/i18n/locale";
import { guideHref } from "@/lib/marketing/routes";

export async function SiteFooter({
  locale,
  current,
}: {
  locale: Locale;
  current: string;
}) {
  const [t, tNav, tLocale] = await Promise.all([
    getTranslations({ locale, namespace: "marketing.footer" }),
    getTranslations({ locale, namespace: "marketing.nav" }),
    getTranslations({ locale, namespace: "marketing.locale" }),
  ]);
  const columns = [
    {
      title: t("product"),
      links: [
        { href: `/${locale}/features`, label: tNav("features") },
        { href: `/${locale}/pricing`, label: tNav("pricing") },
        { href: "/docs", label: tNav("docs") },
      ],
    },
    {
      title: t("company"),
      links: [
        { href: `/${locale}/about`, label: tNav("about") },
        { href: `/${locale}/contact`, label: tNav("contact") },
      ],
    },
    {
      title: t("resources"),
      links: [
        { href: guideHref(locale), label: t("guides") },
        { href: "/docs/api", label: t("apiReference") },
        { href: `/${locale}/abuse#report`, label: t("reportLink") },
      ],
    },
    {
      title: t("legal"),
      links: [
        { href: `/${locale}/privacy`, label: t("privacy") },
        { href: `/${locale}/terms`, label: t("terms") },
        { href: `/${locale}/abuse`, label: t("abuse") },
      ],
    },
  ];
  return (
    <footer className="border-t border-line">
      <div className="mx-auto max-w-[1200px] px-4 pt-14 pb-10 md:px-6">
        <div className="grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-[1.4fr_repeat(4,1fr)]">
          <div className="flex max-w-[30ch] flex-col gap-4">
            <a
              href={`/${locale}`}
              aria-label={tNav("home")}
              className="flex items-center gap-2.5 self-start rounded-control"
            >
              <ShortnMark size={24} />
              <span className="font-display text-emphasis font-extrabold tracking-[-0.02em]">
                Shortn
              </span>
            </a>
            <p className="text-body text-pretty text-fg-muted">
              {t("tagline")}
            </p>
          </div>
          {columns.map((column) => (
            <nav key={column.title} aria-label={column.title}>
              <h2 className="text-small font-semibold">{column.title}</h2>
              <ul className="mt-3 flex flex-col gap-2">
                {column.links.map((link) => (
                  <li key={link.href}>
                    <a
                      href={link.href}
                      className="text-body text-fg-muted transition-colors hover:text-fg"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
        <div className="mt-14 flex flex-col gap-4 border-t border-line pt-6 sm:flex-row sm:items-center sm:justify-between">
          <nav aria-label={tLocale("label")}>
            <ul className="flex flex-wrap gap-x-5 gap-y-2">
              {locales.map((option) => (
                <li key={option}>
                  <a
                    href={`/${option}${current}`}
                    hrefLang={option}
                    lang={option === "pt" ? "pt-PT" : option}
                    aria-current={option === locale ? "true" : undefined}
                    className="text-small text-fg-muted transition-colors hover:text-fg aria-[current=true]:font-semibold aria-[current=true]:text-fg"
                  >
                    {tLocale(option)}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
          <p className="font-mono text-meta text-fg-subtle tabular-nums">
            {t("copyright", { year: new Date().getUTCFullYear() })}
          </p>
        </div>
      </div>
    </footer>
  );
}
