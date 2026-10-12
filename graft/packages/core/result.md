# packages/core/result.ts

- Result · type · L2-L4 — type Result<T, E extends string> = | { ok: true; value: T } | { ok: false; error: E; detail?: Record<string, string | number | null> };
- ok · function · L6-L6 — ok = <T>(value: T)
- fail · function · L7-L10 — fail = <E extends string>( error: E, detail?: Record<string, string | number | null>, )
