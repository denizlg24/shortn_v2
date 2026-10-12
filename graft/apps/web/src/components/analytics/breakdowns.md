# apps/web/src/components/analytics/breakdowns.ts

- BreakdownSlug · type · L18-L18 — type BreakdownSlug = keyof typeof breakdownSlugs;
- BreakdownDimension · type · L19-L19 — type BreakdownDimension = (typeof breakdownSlugs)[BreakdownSlug];
- isBreakdownSlug · function · L25-L26 — isBreakdownSlug = (value: string): value is BreakdownSlug
- isOpenBreakdown · function · L29-L30 — isOpenBreakdown = (dimension: BreakdownDimension)
- filterFor · function · L33-L37 — function filterFor(dimension: BreakdownDimension): QueryFilter | null
- toggledFilter · function · L40-L51 — function toggledFilter( query: AnalyticsQuery, dimension: BreakdownDimension, value: string, ): AnalyticsQuery | null
- SortColumn · type · L54-L54 — type SortColumn = (typeof sortColumns)[number];
- SortDirection · type · L55-L55 — type SortDirection = "asc" | "desc";
- TableSort · interface · L56-L59 — interface TableSort
- firstDirection · function · L62-L63 — firstDirection = (column: SortColumn): SortDirection
- parseSort · function · L65-L72 — function parseSort(sort: string | null, dir: string | null): TableSort
- sortParams · function · L75-L84 — function sortParams(sort: TableSort): Record<string, string>
- nextSort · function · L87-L90 — nextSort = (current: TableSort, column: SortColumn): TableSort
- TableRow · interface · L92-L97 — interface TableRow
- sortRows · function · L99-L116 — function sortRows<T extends TableRow>( rows: readonly T[], sort: TableSort, collator: Intl.Collator, ): T[]
- measure · function · L105-L110 — measure = (row: T)
