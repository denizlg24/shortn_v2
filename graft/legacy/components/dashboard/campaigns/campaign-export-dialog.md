# legacy/components/dashboard/campaigns/campaign-export-dialog.tsx

- CampaignExportDialogProps · interface · L38-L43 — interface CampaignExportDialogProps
- CampaignExportDialog · function · L45-L330 — function CampaignExportDialog({ campaignId, campaignTitle, stats, trigger, }: CampaignExportDialogProps)
- clearFilters · function · L72-L78 — clearFilters = ()
- handleExport · function · L80-L113 — handleExport = async ()
- FilterSection · function · L115-L160 — FilterSection = ({ label, items, selected, onToggle, }: { label: string; items: Array<{ name: string; clicks: number }>; selected: string[]; onToggle: (value: string) => void; })
- toggleSelection · function · L162-L172 — toggleSelection = ( value: string, selected: string[], setSelected: (values: string[]) => void, )
