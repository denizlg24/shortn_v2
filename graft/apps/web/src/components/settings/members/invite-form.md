# apps/web/src/components/settings/members/invite-form.tsx

- InviteForm · function · L12-L114 — function InviteForm({ roles, action, cancelHref, plansHref, }: { roles: AssignableRole[]; action: ( state: SettingsFormState, form: FormData, ) => Promise<SettingsFormState>; cancelHref: string; /** Where to upgrade when seats run out; null when only the owner can. */ plansHref: string | null; })
- message · function · L33-L54 — message = (code: string)
