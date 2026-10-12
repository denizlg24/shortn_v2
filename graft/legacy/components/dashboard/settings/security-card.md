# legacy/components/dashboard/settings/security-card.tsx

- usePasswordFormSchema · function · L43-L60 — usePasswordFormSchema = ()
- SecurityCard · function · L62-L556 — SecurityCard = ({ loginRecords, fullLoginRecords, loggedInDevices, }: { loginRecords: TLoginRecord[]; fullLoginRecords: TLoginRecord[]; loggedInDevices: { ipAddress: string | undefined; createdAt: Date; id: string; userAgent: string | undefined; geo_city?: string; geo_country?: string; geo_country_region?: string; geo_region?: string; geo_latitude?: string; geo_longitude?: string; }[]; })
- onSubmit · function · L105-L146 — async function onSubmit(values: z.infer<typeof updatePasswordFormSchema>)
