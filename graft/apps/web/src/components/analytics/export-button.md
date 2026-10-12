# apps/web/src/components/analytics/export-button.tsx

- fileName · function · L12-L13 — fileName = (disposition: string | null, fallback: string)
- ExportButton · function · L16-L84 — function ExportButton({ workspace, query, params, gate, }: { workspace: string; query: AnalyticsQuery; /** Scope of the export, e.g. `{ campaign: id }`. */ params: Record<string, string>; gate: PlanId | null; })
- download · function · L40-L69 — download = async ()
