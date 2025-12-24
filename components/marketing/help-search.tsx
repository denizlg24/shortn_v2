"use client";

import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { useState, useMemo } from "react";
import { Link } from "@/i18n/navigation";

interface Article {
  title: string;
  href: string;
  description: string;
  category: string;
}

const allArticles: Article[] = [
  {
    title: "Getting Started with Shortn",
    href: "/help/articles/getting-started",
    description:
      "Learn the basics of creating links, tracking analytics, and navigating your dashboard",
    category: "Getting Started",
  },
  {
    title: "Creating Short Links",
    href: "/help/articles/links/creating-links",
    description:
      "Master link creation with custom back-halves, password protection, and tags",
    category: "Links",
  },
  {
    title: "Managing Your Links",
    href: "/help/articles/links/managing-links",
    description: "Edit, organize, and control your shortened links",
    category: "Links",
  },
  {
    title: "UTM Parameters",
    href: "/help/articles/links/utm-parameters",
    description: "Track campaign performance with UTM parameters",
    category: "Links",
  },
  {
    title: "Creating QR Codes",
    href: "/help/articles/qr-codes/creating-qr-codes",
    description: "Generate and customize QR codes for print and digital use",
    category: "QR Codes",
  },
  {
    title: "Managing QR Codes",
    href: "/help/articles/qr-codes/managing-qr-codes",
    description: "Edit, download, and organize your QR codes",
    category: "QR Codes",
  },
  {
    title: "Creating Bio Pages",
    href: "/help/articles/bio-pages/creating-bio-pages",
    description:
      "Build beautiful link-in-bio pages for Instagram, TikTok, and more (Pro)",
    category: "Bio Pages",
  },
  {
    title: "Customizing Bio Pages",
    href: "/help/articles/bio-pages/customizing-bio-pages",
    description: "Design beautiful, branded bio pages that stand out",
    category: "Bio Pages",
  },
  {
    title: "Understanding Analytics",
    href: "/help/articles/analytics/understanding-analytics",
    description:
      "Track clicks, locations, devices, and measure your link performance",
    category: "Analytics",
  },
  {
    title: "Organizing Campaigns",
    href: "/help/articles/campaigns/organizing-campaigns",
    description: "Group and track links by marketing campaigns (Pro)",
    category: "Campaigns",
  },
  {
    title: "Plans & Pricing",
    href: "/help/articles/billing/plans-pricing",
    description: "Compare plans and find the perfect fit for your needs",
    category: "Billing",
  },
  {
    title: "Upgrading Your Plan",
    href: "/help/articles/billing/upgrading-plans",
    description:
      "Learn how to upgrade, downgrade, and manage your subscription",
    category: "Billing",
  },
];

export function HelpSearch() {
  const [query, setQuery] = useState("");

  const filteredArticles = useMemo(() => {
    if (!query.trim()) return [];

    const searchTerm = query.toLowerCase();
    return allArticles.filter(
      (article) =>
        article.title.toLowerCase().includes(searchTerm) ||
        article.description.toLowerCase().includes(searchTerm) ||
        article.category.toLowerCase().includes(searchTerm),
    );
  }, [query]);

  return (
    <div className="w-full relative">
      <div className="relative flex items-center">
        <Input
          placeholder="Search for help articles..."
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
              No articles found for &quot;{query}&quot;
            </div>
          )}
        </div>
      )}
    </div>
  );
}
