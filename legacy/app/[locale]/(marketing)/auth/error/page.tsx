import { getTranslations, setRequestLocale } from "next-intl/server";
import Image from "next/image";
import illust from "@/public/404_illustration.svg";
import { Link } from "@/i18n/navigation";

type BetterAuthError =
  | "invalid_callback_request"
  | "state_not_found"
  | "account_already_linked_to_different_user"
  | "email_doesnt_match"
  | "email_not_found"
  | "no_callback_url"
  | "no_code"
  | "oauth_provider_not_found"
  | "unable_to_link_account"
  | "unable_to_get_user_info"
  | "state_mismatch"
  | "signup_disabled"
  | "please_restart_the_process";

export default async function Home({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | unknown>>;
}) {
  const { locale } = await params;
  const searchParameters = await searchParams;
  setRequestLocale(locale);
  const t = await getTranslations("auth-error");
  const errorType = (searchParameters.error as string).toLowerCase() as
    | string
    | undefined;

  const ERROR_MESSAGES: Record<
    BetterAuthError,
    { title: string; description: string }
  > = {
    invalid_callback_request: {
      title: t("invalid-callback-request"),
      description: t(
        "the-authentication-callback-could-not-be-processed-please-try-signing-in-again",
      ),
    },
    state_not_found: {
      title: t("authentication-state-lost"),
      description: t(
        "the-authentication-state-was-not-found-this-may-happen-if-you-navigated-directly-to-this-page-please-try-signing-in-again",
      ),
    },
    account_already_linked_to_different_user: {
      title: t("account-already-linked"),
      description: t(
        "this-account-is-already-linked-to-a-different-user-please-sign-in-with-a-different-account-or-contact-support",
      ),
    },
    email_doesnt_match: {
      title: t("email-mismatch"),
      description: t(
        "the-email-from-your-provider-doesnt-match-your-account-please-try-again-with-the-correct-account",
      ),
    },
    email_not_found: {
      title: t("email-not-found"),
      description: t(
        "we-couldnt-find-an-account-with-this-email-please-sign-up-first",
      ),
    },
    no_callback_url: {
      title: t("missing-callback-url"),
      description: t(
        "the-authentication-callback-url-is-missing-please-try-signing-in-again",
      ),
    },
    no_code: {
      title: t("missing-authorization-code"),
      description: t(
        "the-authorization-code-is-missing-from-the-callback-please-try-signing-in-again",
      ),
    },
    oauth_provider_not_found: {
      title: t("provider-not-found"),
      description: t(
        "the-authentication-provider-could-not-be-found-please-contact-support",
      ),
    },
    unable_to_link_account: {
      title: t("unable-to-link-account"),
      description: t(
        "we-were-unable-to-link-your-account-please-try-again-or-contact-support",
      ),
    },
    unable_to_get_user_info: {
      title: t("unable-to-get-user-info"),
      description: t(
        "we-couldnt-retrieve-your-information-from-the-provider-please-try-again",
      ),
    },
    state_mismatch: {
      title: t("authentication-state-mismatch"),
      description: t(
        "the-authentication-state-doesnt-match-this-may-be-a-security-issue-please-try-signing-in-again",
      ),
    },
    signup_disabled: {
      title: t("sign-up-disabled"),
      description: t(
        "new-user-registration-is-currently-disabled-please-contact-support-if-you-need-access",
      ),
    },
    please_restart_the_process: {
      title: t("social-login-issue"),
      description: t(
        "there-was-a-state-mismatch-during-the-social-login-process-please-try-signing-in-with-your-social-account-again",
      ),
    },
  };

  const isValidError = errorType && errorType in ERROR_MESSAGES;
  const error = isValidError
    ? ERROR_MESSAGES[errorType as BetterAuthError]
    : null;

  return (
    <main className="w-full flex flex-col items-center max-w-7xl px-4 mx-auto">
      <div className="w-full max-w-4xl md:grid flex flex-col grid-cols-3 my-12 md:gap-4 gap-6 mt-20">
        <div className="col-span-2 w-full flex flex-col md:items-start items-center md:text-left text-center gap-4">
          <h1 className="font-bold text-4xl">{t("oops")}</h1>
          {error ? (
            <>
              <h2 className="text-xl">{error.title}</h2>
              <p className="text-muted-foreground">{error.description}</p>
            </>
          ) : (
            <>
              <h2 className="text-xl">{t("authentication-error")}</h2>
              <p className="text-muted-foreground">
                {t(
                  "an-unexpected-error-occurred-during-authentication-please-try-again",
                )}{" "}
              </p>
              {errorType && (
                <p className="text-sm text-muted-foreground">
                  {t("error-code")} {errorType}
                </p>
              )}
            </>
          )}
          <div className="flex flex-col gap-1 text-sm">
            <p>{t("here-are-some-helpful-links-instead")}</p>
            <Link className="text-primary" href={"/"}>
              {t("home")}{" "}
            </Link>
            <Link className="text-primary" href={"/login"}>
              {t("login")}{" "}
            </Link>
            <Link className="text-primary" href={"/help"}>
              {t("help")}{" "}
            </Link>
          </div>
        </div>
        <div className="col-span-1 w-full relative min-h-[250px]">
          <Image src={illust} alt="Authentication error illustration" fill />
        </div>
      </div>
    </main>
  );
}
