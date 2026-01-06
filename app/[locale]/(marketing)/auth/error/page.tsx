import { setRequestLocale } from "next-intl/server";
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

const ERROR_MESSAGES: Record<
  BetterAuthError,
  { title: string; description: string }
> = {
  invalid_callback_request: {
    title: "Invalid Callback Request",
    description:
      "The authentication callback could not be processed. Please try signing in again.",
  },
  state_not_found: {
    title: "Authentication State Lost",
    description:
      "The authentication state was not found. This may happen if you navigated directly to this page. Please try signing in again.",
  },
  account_already_linked_to_different_user: {
    title: "Account Already Linked",
    description:
      "This account is already linked to a different user. Please sign in with a different account or contact support.",
  },
  email_doesnt_match: {
    title: "Email Mismatch",
    description:
      "The email from your provider doesn't match your account. Please try again with the correct account.",
  },
  email_not_found: {
    title: "Email Not Found",
    description:
      "We couldn't find an account with this email. Please sign up first.",
  },
  no_callback_url: {
    title: "Missing Callback URL",
    description:
      "The authentication callback URL is missing. Please try signing in again.",
  },
  no_code: {
    title: "Missing Authorization Code",
    description:
      "The authorization code is missing from the callback. Please try signing in again.",
  },
  oauth_provider_not_found: {
    title: "Provider Not Found",
    description:
      "The authentication provider could not be found. Please contact support.",
  },
  unable_to_link_account: {
    title: "Unable to Link Account",
    description:
      "We were unable to link your account. Please try again or contact support.",
  },
  unable_to_get_user_info: {
    title: "Unable to Get User Info",
    description:
      "We couldn't retrieve your information from the provider. Please try again.",
  },
  state_mismatch: {
    title: "Authentication State Mismatch",
    description:
      "The authentication state doesn't match. This may be a security issue. Please try signing in again.",
  },
  signup_disabled: {
    title: "Sign Up Disabled",
    description:
      "New user registration is currently disabled. Please contact support if you need access.",
  },
  please_restart_the_process: {
    title: "Social Login Issue",
    description:
      "There was a state mismatch during the social login process. Please try signing in with your social account again.",
  },
};

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

  const errorType = (searchParameters.error as string).toLowerCase() as
    | string
    | undefined;

  const isValidError = errorType && errorType in ERROR_MESSAGES;
  const error = isValidError
    ? ERROR_MESSAGES[errorType as BetterAuthError]
    : null;

  return (
    <main className="w-full flex flex-col items-center max-w-7xl px-4 mx-auto">
      <div className="w-full max-w-4xl md:grid flex flex-col grid-cols-3 my-12 md:gap-4 gap-6 mt-20">
        <div className="col-span-2 w-full flex flex-col md:items-start items-center md:text-left text-center gap-4">
          <h1 className="font-bold text-4xl">Oops!</h1>
          {error ? (
            <>
              <h2 className="text-xl">{error.title}</h2>
              <p className="text-muted-foreground">{error.description}</p>
            </>
          ) : (
            <>
              <h2 className="text-xl">Authentication Error</h2>
              <p className="text-muted-foreground">
                An unexpected error occurred during authentication. Please try
                again.
              </p>
              {errorType && (
                <p className="text-sm text-muted-foreground">
                  Error code: {errorType}
                </p>
              )}
            </>
          )}
          <div className="flex flex-col gap-1 text-sm">
            <p>Here are some helpful links instead:</p>
            <Link className="text-primary" href={"/"}>
              Home
            </Link>
            <Link className="text-primary" href={"/login"}>
              Login
            </Link>
            <Link className="text-primary" href={"/help"}>
              Help
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
