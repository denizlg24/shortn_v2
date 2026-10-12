# legacy/app/[locale]/(marketing)/auth/error/page.tsx

- BetterAuthError · type · L6-L19 — type BetterAuthError = | "invalid_callback_request" | "state_not_found" | "account_already_linked_to_different_user" | "email_doesnt_match" | "email_not_found" | "no_callback_url" | "no_code" | "oauth_provider_not_found" | "unable_to_link_account" | "unable_to_get_user_info" | "state_mismatch" | "signup_disabled" | "please_restart_the_process";
- Home · function · L21-L169 — async function Home({ params, searchParams, }: { params: Promise<{ locale: string }>; searchParams: Promise<Record<string, string | string[] | unknown>>; })
