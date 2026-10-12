# legacy/components/dashboard/links/charts/time-of-day-stacked-bar-chart.tsx

- TimeOfDayStackBarData · type · L23-L26 — type TimeOfDayStackBarData = { date: string; [time: string]: number | string; };
- groupClicksByDateAndTimeBuckets · function · L28-L90 — function groupClicksByDateAndTimeBuckets( clicks: TClickEntry[], bucketSizeHours = 6, startDate?: Date, endDate?: Date, ): TimeOfDayStackBarData[]
- getBucketLabel · function · L48-L55 — getBucketLabel = (hour: number)
- generateChartConfig · function · L92-L106 — function generateChartConfig(data: TimeOfDayStackBarData[])
- TimeOfDayStackedBarChart · function · L110-L162 — function TimeOfDayStackedBarChart({ chartData, }: { chartData: TimeOfDayStackBarData[]; })
