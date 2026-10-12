# apps/web/src/app/safety/[key]/page.tsx

- pageLocale · function · L17-L22 — async function pageLocale( searchParams: Promise<Record<string, string | string[] | undefined>>, ): Promise<Locale>
- generateMetadata · function · L24-L30 — async function generateMetadata({ searchParams, }: PageProps<"/safety/[key]">): Promise<Metadata>
- isStatus · function · L39-L40 — isStatus = (value: string): value is keyof typeof statusTone
- ReportState · type · L43-L43 — type ReportState = (typeof reportStates)[number];
- isReportState · function · L44-L45 — isReportState = (value: unknown): value is ReportState
- SafetyPage · function · L47-L241 — async function SafetyPage({ params, searchParams, }: PageProps<"/safety/[key]">)
- frame · function · L73-L77 — frame = (children: ReactNode)
