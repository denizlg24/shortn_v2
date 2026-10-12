# legacy/components/dashboard/links/charts/referrer-stacked-bar-chart.tsx

- groupClicksByDateAndReferrer · function · L21-L78 — function groupClicksByDateAndReferrer( clicks: TClickEntry[], startDate?: Date, endDate?: Date, ): StackedBarData[]
- generateChartConfig · function · L80-L101 — function generateChartConfig(data: StackedBarData[])
- StackedBarData · type · L103-L106 — type StackedBarData = { date: string; [referrer: string]: number | string; };
- ReferrerStackedBarChart · function · L108-L156 — function ReferrerStackedBarChart({ chartData, }: { chartData: StackedBarData[]; })
