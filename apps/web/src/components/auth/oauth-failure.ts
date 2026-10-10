export type OAuthFailure = "notLinked" | "other" | null;

// better-auth appends `?error=<code>` to errorCallbackURL when OAuth fails.
export function parseOAuthFailure(
  error: string | string[] | undefined,
): OAuthFailure {
  if (typeof error !== "string" || !error) return null;
  return error === "account_not_linked" ? "notLinked" : "other";
}
