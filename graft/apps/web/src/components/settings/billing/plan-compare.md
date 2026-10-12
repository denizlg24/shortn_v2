# apps/web/src/components/settings/billing/plan-compare.tsx

- Column · type · L33-L33 — type Column = BillingOverview["catalog"][number];
- PlanCompare · function · L36-L143 — function PlanCompare({ overview, actions, eurPerUsd, }: { overview: BillingOverview; eurPerUsd?: number | null; actions: Partial<Record<PlanId, ReactNode>>; })
- Cell · function · L145-L155 — function Cell({ current, children, }: { current: boolean; children: ReactNode; })
- Included · function · L157-L170 — function Included({ value }: { value: boolean })
- LimitValue · function · L172-L197 — function LimitValue({ column, row, }: { column: Column; row: (typeof limitRows)[number]; })
