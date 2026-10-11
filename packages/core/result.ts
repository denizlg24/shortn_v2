// Expected failures are values; exceptions are reserved for bugs (01).
export type Result<T, E extends string> =
  | { ok: true; value: T }
  | { ok: false; error: E; detail?: Record<string, string | number | null> };

export const ok = <T>(value: T) => ({ ok: true, value }) as const;
export const fail = <E extends string>(
  error: E,
  detail?: Record<string, string | number | null>,
) => ({ ok: false, error, ...(detail ? { detail } : {}) }) as const;
