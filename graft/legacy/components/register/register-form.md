# legacy/components/register/register-form.tsx

- PasswordRequirement · function · L28-L44 — PasswordRequirement = ({ met, label, }: { met: boolean; label: string; })
- mapBetterAuthError · function · L77-L184 — mapBetterAuthError = ( error: { code?: string; message?: string; status?: number }, form: ReturnType<typeof useForm<z.infer<typeof registerFormSchema>>>, t: ReturnType<typeof useTranslations<"register">>, )
- RegisterForm · function · L186-L500 — RegisterForm = ()
- onSubmit · function · L216-L239 — async function onSubmit(values: z.infer<typeof registerFormSchema>)
- onSuccess · method · L228-L232 — onSuccess()
- onError · method · L233-L235 — onError(context)
