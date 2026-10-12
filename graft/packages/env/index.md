# packages/env/index.ts

- value · function · L3-L7 — value = <S extends z.ZodType>( schema: S, example: string, description: string, )
- url · function · L8-L9 — url = (example: string, description: string)
- httpUrl · function · L11-L12 — httpUrl = (example: string, description: string)
- secret · function · L13-L27 — secret = (description: string)
- bioRules · function · L63-L89 — bioRules = (app: "web" | "redirect" | "api" | "worker")
- productionRules · function · L90-L119 — productionRules = ( env: Record<string, unknown>, ctx: z.RefinementCtx, )
- liveBillingNeedsMail · function · L397-L409 — liveBillingNeedsMail = ( env: Record<string, unknown>, ctx: z.RefinementCtx, )
- parseEnv · function · L470-L484 — function parseEnv<S extends z.ZodType>( schema: S, source: Record<string, string | undefined>, ): z.output<S>
- envExample · function · L486-L508 — function envExample(): string
