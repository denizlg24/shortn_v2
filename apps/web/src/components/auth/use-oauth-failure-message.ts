import { useTranslations } from "next-intl";
import type { OAuthFailure } from "./oauth-failure";

export function useOAuthFailureMessage(failure: OAuthFailure): string | null {
  const t = useTranslations("auth.errors");
  if (failure === "notLinked") return t("oauthAccountNotLinked");
  return failure ? t("oauth") : null;
}
