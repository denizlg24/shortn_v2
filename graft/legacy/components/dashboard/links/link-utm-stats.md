# legacy/components/dashboard/links/link-utm-stats.tsx

- ViewMode · type · L58-L58 — type ViewMode = "table" | "grouped";
- GroupedData · interface · L60-L66 — interface GroupedData
- groupUtmData · function · L68-L93 — function groupUtmData(clicks: TClickEntry[]): GroupedData
- groupBy · function · L73-L84 — groupBy = (key: string): { name: string; count: number }[]
- LinkUtmStats · function · L95-L684 — LinkUtmStats = ({ unlocked, initialClicks, createdAt, campaign, }: { unlocked: boolean; initialClicks: TClickEntry[]; createdAt: Date; campaign?: { _id: string; title: string }; })
- getDateRange · function · L117-L170 — function getDateRange(option: string, createdAt: Date): DateRange
- GroupedSection · function · L257-L325 — GroupedSection = ({ title, icon: Icon, items, total, defaultOpen = false, }: { title: string; icon: typeof Globe; items: { name: string; count: number }[]; total: number; defaultOpen?: boolean; })
