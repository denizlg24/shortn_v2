"use client";

import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { useState, useMemo } from "react";
import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";

interface Article {
  titleKey: string;
  descKey: string;
  href: string;
  categoryKey: string;
}

const articleData: Article[] = [
  {
    titleKey: "getting-started-title",
    descKey: "getting-started-desc",
    href: "/help/articles/getting-started",
    categoryKey: "getting-started",
  },
  {
    titleKey: "creating-links-title",
    descKey: "creating-links-desc",
    href: "/help/articles/links/creating-links",
    categoryKey: "links",
  },
  {
    titleKey: "managing-links-title",
    descKey: "managing-links-desc",
    href: "/help/articles/links/managing-links",
    categoryKey: "links",
  },
  {
    titleKey: "utm-title",
    descKey: "utm-desc",
    href: "/help/articles/links/utm-parameters",
    categoryKey: "links",
  },
  {
    titleKey: "creating-qr-title",
    descKey: "creating-qr-desc",
    href: "/help/articles/qr-codes/creating-qr-codes",
    categoryKey: "qr-codes",
  },
  {
    titleKey: "managing-qr-title",
    descKey: "managing-qr-desc",
    href: "/help/articles/qr-codes/managing-qr-codes",
    categoryKey: "qr-codes",
  },
  {
    titleKey: "creating-bio-title",
    descKey: "creating-bio-desc",
    href: "/help/articles/bio-pages/creating-bio-pages",
    categoryKey: "bio-pages",
  },
  {
    titleKey: "customizing-bio-title",
    descKey: "customizing-bio-desc",
    href: "/help/articles/bio-pages/customizing-bio-pages",
    categoryKey: "bio-pages",
  },
  {
    titleKey: "understanding-analytics-title",
    descKey: "understanding-analytics-desc",
    href: "/help/articles/analytics/understanding-analytics",
    categoryKey: "analytics",
  },
  {
    titleKey: "organizing-campaigns-title",
    descKey: "organizing-campaigns-desc",
    href: "/help/articles/campaigns/organizing-campaigns",
    categoryKey: "campaigns",
  },
  {
    titleKey: "plans-pricing-title",
    descKey: "plans-pricing-desc",
    href: "/help/articles/billing/plans-pricing",
    categoryKey: "billing",
  },
  {
    titleKey: "upgrading-title",
    descKey: "upgrading-desc",
    href: "/help/articles/billing/upgrading-plans",
    categoryKey: "billing",
  },
];

export function HelpSearch() {
  const [query, setQuery] = useState("");
  const t = useTranslations("help");
  const tArticles = useTranslations("help.articles");
  const tCategories = useTranslations("help.categories");

  const allArticles = useMemo(() => {
    return articleData.map((article) => ({
      title: tArticles(article.titleKey),
      description: tArticles(article.descKey),
      href: article.href,
      category: tCategories(article.categoryKey),
    }));
  }, [tArticles, tCategories]);

  const filteredArticles = useMemo(() => {
    if (!query.trim()) return [];

    const searchTerm = query.toLowerCase();
    return allArticles.filter(
      (article) =>
        article.title.toLowerCase().includes(searchTerm) ||
        article.description.toLowerCase().includes(searchTerm) ||
        article.category.toLowerCase().includes(searchTerm),
    );
  }, [query, allArticles]);

  return (
    <div className="w-full relative text-left!">
      <div className="relative flex items-center">
        <Input
          placeholder={t("search-placeholder")}
          className="w-full pl-12 xs:h-12 h-10 rounded-sm bg-muted"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="absolute left-4 top-1/2 -translate-y-1/2 flex items-center gap-2 text-muted-foreground">
          <Search className="w-4 h-4" />
        </div>
      </div>

      {query.trim() && (
        <div className="absolute top-full mt-2 w-full bg-background border rounded-lg shadow-lg z-50 max-h-96 overflow-y-auto">
          {filteredArticles.length > 0 ? (
            <div className="p-2">
              {filteredArticles.map((article) => (
                <Link
                  key={article.href}
                  href={article.href}
                  className="block p-3 hover:bg-muted rounded-lg transition-colors"
                  onClick={() => setQuery("")}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-medium text-sm">{article.title}</h3>
                      <p className="text-xs text-muted-foreground mt-1">
                        {article.description}
                      </p>
                      <p className="text-xs text-muted-foreground/70 mt-1">
                        {article.category}
                      </p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="p-6 text-center text-sm text-muted-foreground">
              {t("no-results", { query })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
