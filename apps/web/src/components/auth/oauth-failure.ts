export type OAuthFailure = "notLinked" | "suspended" | "other" | null;

// better-auth appends `?error=<code>` to errorCallbackURL when OAuth fails;
// the handoff uses the same parameter for a suspended account.
export function parseOAuthFailure(
  error: string | string[] | undefined,
): OAuthFailure {
  if (typeof error !== "string" || !error) return null;
  if (error === "ACCOUNT_SUSPENDED") return "suspended";
  return error === "account_not_linked" ? "notLinked" : "other";
}
