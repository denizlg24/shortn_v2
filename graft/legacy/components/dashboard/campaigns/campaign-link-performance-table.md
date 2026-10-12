# legacy/components/dashboard/campaigns/campaign-link-performance-table.tsx

- UtmLinkData · interface · L60-L65 — interface UtmLinkData
- LinkPerformanceData · interface · L67-L72 — interface LinkPerformanceData
- CampaignLinkPerformanceTableProps · interface · L74-L79 — interface CampaignLinkPerformanceTableProps
- SortField · type · L81-L81 — type SortField = "title" | "clicks";
- SortDirection · type · L82-L82 — type SortDirection = "asc" | "desc";
- buildUtmUrl · function · L86-L101 — function buildUtmUrl( shortUrl: string, utm: UtmLinkData, campaignTitle: string, ): string
- getUtmLabel · function · L103-L110 — function getUtmLabel(utm: UtmLinkData): string
- CampaignLinkPerformanceTable · function · L112-L565 — function CampaignLinkPerformanceTable({ links, loading, campaignId, campaignTitle, }: CampaignLinkPerformanceTableProps)
- toggleExpanded · function · L125-L135 — toggleExpanded = (urlCode: string)
- handleCopyUrl · function · L137-L142 — handleCopyUrl = async (url: string)
- handleSort · function · L144-L151 — handleSort = (field: SortField)
- renderSortIcon · function · L170-L179 — renderSortIcon = (field: SortField)
