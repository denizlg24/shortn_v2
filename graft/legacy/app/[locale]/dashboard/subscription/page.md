# legacy/app/[locale]/dashboard/subscription/page.tsx

- generateMetadata · function · L18-L43 — async function generateMetadata()
- Features · type · L142-L142 — type Features = typeof features;
- SectionKey · type · L143-L143 — type SectionKey = keyof Features;
- TitleKey · type · L144-L144 — type TitleKey<S extends SectionKey> = keyof Features[S];
- PlanAction · function · L146-L233 — function PlanAction({ plan, currentPlan, pendingChange, t, }: { plan: (typeof plans)[number]; currentPlan: string; pendingChange: Awaited<ReturnType<typeof getPendingScheduledChange>>; t: Awaited<ReturnType<typeof getTranslations<"subscription">>>; })
- Home · function · L235-L629 — async function Home({ params, }: { params: Promise<{ locale: string }>; })
