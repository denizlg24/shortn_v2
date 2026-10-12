# apps/web/src/app/authenticate/[key]/page.tsx

- generateMetadata · function · L16-L19 — async function generateMetadata(): Promise<Metadata>
- FieldError · type · L23-L23 — type FieldError = (typeof fieldErrors)[number];
- FormError · type · L24-L24 — type FormError = (typeof formErrors)[number];
- isFieldError · function · L26-L27 — isFieldError = (value: unknown): value is FieldError
- isFormError · function · L28-L29 — isFormError = (value: unknown): value is FormError
- AuthenticatePage · function · L34-L154 — async function AuthenticatePage({ params, searchParams, }: PageProps<"/authenticate/[key]">)
