# packages/ui/scripts/token-checks.ts

- ThemeName · type · L13-L13 — type ThemeName = "light" | "dark";
- CheckSection · type · L14-L14 — type CheckSection = "text" | "non-text" | "series" | "gamut";
- TokenCheckResult · interface · L16-L22 — interface TokenCheckResult
- Tokens · type · L24-L24 — type Tokens = Map<string, string>;
- readBlock · function · L29-L39 — function readBlock(source: string, selector: string): Tokens
- readThemes · function · L41-L44 — function readThemes(source: string): Record<ThemeName, Tokens>
- resolve · function · L46-L66 — function resolve(tokens: Tokens, name: string, depth = 0): Oklch
- ContrastPair · interface · L68-L72 — interface ContrastPair
- runTokenChecks · function · L104-L154 — function runTokenChecks(source: string): TokenCheckResult[]
