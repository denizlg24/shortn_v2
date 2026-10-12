# apps/web/src/app/[workspace]/settings/billing/plans/page.tsx

- generateMetadata · function · L18-L21 — async function generateMetadata(): Promise<Metadata>
- PaidPlan · type · L27-L27 — type PaidPlan = (typeof paidPlans)[number];
- isPaid · function · L28-L29 — isPaid = (plan: PlanId): plan is PaidPlan
- PlansPage · function · L38-L171 — async function PlansPage({ params, }: PageProps<"/[workspace]/settings/billing/plans">)
- linkButton · function · L56-L67 — linkButton = (href: string, label: string)
