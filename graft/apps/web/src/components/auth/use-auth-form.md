# apps/web/src/components/auth/use-auth-form.ts

- FieldErrors · type · L4-L4 — type FieldErrors<F extends string> = { [K in F]?: string | undefined };
- SubmitOutcome · type · L7-L8 — type SubmitOutcome<F extends string> = "done" | "navigating" | { field: F; error: string } | { formError: string };
- Options · interface · L10-L14 — interface Options
- useAuthForm · function · L16-L108 — function useAuthForm<F extends string>( initial: Record<F, string>, validate: (values: Record<F, string>) => FieldErrors<F>, { fallbackError, initialFormError = null }: Options, )
- id · function · L32-L32 — id = (name: F)
- errorFor · function · L34-L36 — errorFor = (name: F): string | undefined
- setValue · function · L38-L42 — setValue = (name: F, value: string)
- field · function · L44-L54 — field = (name: F)
- submit · function · L56-L95 — submit = (action: (values: Record<F, string>) => Promise<SubmitOutcome<F>>)
- focusFirstInvalid · function · L62-L63 — focusFirstInvalid = ()
