import { useTranslations } from "next-intl";
import type { OAuthFailure } from "./oauth-failure";

export function useOAuthFailureMessage(failure: OAuthFailure): string | null {
  const t = useTranslations("auth.errors");
  if (failure === "notLinked") return t("oauthAccountNotLinked");
  if (failure === "suspended") return t("accountSuspended");
  return failure ? t("oauth") : null;
}
