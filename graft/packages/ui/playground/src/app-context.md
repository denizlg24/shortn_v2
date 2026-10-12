# packages/ui/playground/src/app-context.tsx

- Section · type · L14-L22 — type Section = | "links" | "analytics" | "qr" | "bio" | "campaigns" | "domains" | "settings" | "gallery";
- DemoState · type · L23-L24 — type DemoState = "ready" | "empty" | "loading" | "error" | "readonly" | "long";
- ThemePreference · type · L25-L25 — type ThemePreference = "light" | "dark" | "system";
- Route · interface · L46-L49 — interface Route
- parseHash · function · L51-L59 — function parseHash(hash: string): Route
- subscribeHash · function · L61-L64 — subscribeHash = (callback: () => void)
- hashSnapshot · function · L65-L65 — hashSnapshot = ()
- darkQuery · function · L67-L67 — darkQuery = ()
- subscribeScheme · function · L68-L72 — subscribeScheme = (callback: () => void)
- initialPreference · function · L74-L83 — function initialPreference<T extends string>( param: string, storageKey: string, allowed: readonly T[], fallback: T, ): T
- PlaygroundValue · interface · L85-L99 — interface PlaygroundValue
- PlaygroundProvider · function · L103-L171 — function PlaygroundProvider({ children }: { children: ReactNode })
- usePlayground · function · L173-L178 — function usePlayground(): PlaygroundValue
