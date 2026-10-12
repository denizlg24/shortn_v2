# apps/web/src/components/analytics/analytics-view.tsx

- delta · function · L60-L61 — delta = (current: number, previous: number)
- AnalyticsView · function · L63-L305 — function AnalyticsView({ workspace, scope, title, summary, breakdownGate, embedded = false, csvExport, links, }: { workspace: string; scope: AnalyticsScope; /** The page title, or the section's accessible name when embedded. */ title: ReactNode; /** Rendered between the filters and the numbers, e.g. the link's details. */ summary?: ReactNode; /** Plan that unlocks breakdowns and filters; null when the plan has them. */ breakdownGate: PlanId | null; /** Inside a `Page` that owns the heading and the gutters. */ embedded?: boolean; /** Adds an export of the raw events for the selected range and filters. */ csvExport?: { params: Record<string, string>; gate: PlanId | null }; /** The workspace's links for the Link filter (server-loaded). */ links?: LinkOption[]; })
- rowHref · function · L127-L130 — rowHref = (dimension: BreakdownDimension)
- seeAllHref · function · L131-L134 — seeAllHref = (slug: BreakdownSlug)
- statsFor · function · L307-L339 — function statsFor( data: AnalyticsResult, { labels, topCountry, scansOnly, intlLocale, }: { labels: Record<"clicks" | "scans" | "uniques" | "topCountry", string>; /** Null when the plan has no country breakdown. */ topCountry: string | null; /** A QR scope counts scans only, so a clicks figure would always read 0. */ scansOnly: boolean; intlLocale: string; }, ): Stat[]
- number · function · L323-L330 — number = (key: "clicks" | "scans" | "uniques"): Stat
