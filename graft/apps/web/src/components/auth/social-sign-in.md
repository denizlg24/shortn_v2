# apps/web/src/components/auth/social-sign-in.tsx

- Provider · type · L9-L9 — type Provider = "github" | "google";
- EnabledProviders · type · L10-L10 — type EnabledProviders = Record<Provider, boolean>;
- hasSocialSignIn · function · L12-L13 — hasSocialSignIn = (providers: EnabledProviders)
- SocialSignIn · function · L16-L82 — function SocialSignIn({ providers, callbackURL = "/", errorCallbackURL, disabled, onError, }: { providers: EnabledProviders; /** Where the user lands after signing in. */ callbackURL?: string; /** Where better-auth sends the user back with `?error=` if OAuth fails. */ errorCallbackURL: string; disabled: boolean; onError: (message: string) => void; })
- start · function · L34-L50 — start = async (provider: Provider)
