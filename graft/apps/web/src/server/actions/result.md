# apps/web/src/server/actions/result.ts

- ActionResult · type · L3-L9 — type ActionResult<T> = | { ok: true; data: T } | { ok: false; error: string; detail?: Record<string, string | number | null>; };
- toAction · function · L11-L22 — toAction = <T, E extends string>( result: | { ok: true; value: T } | { ok: false; error: E; detail?: Record<string, string | number | null> }, ): ActionResult<T>
