# apps/web/src/components/analytics/breakdown-table.tsx

- RowLabel · function · L12-L34 — function RowLabel({ label, href, active, }: { label: string; href: string | null; active: boolean; })
- TopTable · function · L37-L127 — function TopTable({ title, rows, loading, seeAllHref, rowHref, active, }: { title: string; rows: TableRow[] | undefined; /** True only before the first result; later loads keep the old rows. */ loading: boolean; seeAllHref: string | null; /** Where a row leads (sets its filter), or null when it can't filter. */ rowHref: (value: string) => string | null; active: string | undefined; })
- FullTable · function · L130-L236 — function FullTable({ caption, nameLabel, rows, grandTotal, sort, sortHref, rowHref, }: { caption: string; nameLabel: string; rows: TableRow[]; grandTotal: number; sort: TableSort; sortHref: (column: SortColumn) => string; rowHref: (value: string) => string | null; })
- header · function · L150-L178 — header = (column: SortColumn, label: string, className?: string)
- number · function · L180-L180 — number = (value: number): ReactNode
