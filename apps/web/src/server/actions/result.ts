// What a server action returns to the client: plain data or an error code
// the UI maps to a localized message.
export type ActionResult<T> =
  | { ok: true; data: T }
  | {
      ok: false;
      error: string;
      detail?: Record<string, string | number | null>;
    };

export const toAction = <T, E extends string>(
  result:
    | { ok: true; value: T }
    | { ok: false; error: E; detail?: Record<string, string | number | null> },
): ActionResult<T> =>
  result.ok
    ? { ok: true, data: result.value }
    : {
        ok: false,
        error: result.error,
        ...(result.detail ? { detail: result.detail } : {}),
      };

export const invalidInput = { ok: false, error: "invalid_input" } as const;
