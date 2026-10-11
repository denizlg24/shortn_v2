"use client";

import { authClient } from "@shortn/auth/client";
import { Button } from "@shortn/ui";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { GitHubIcon, GoogleIcon } from "./brand-icons";

type Provider = "github" | "google";
export type EnabledProviders = Record<Provider, boolean>;

export const hasSocialSignIn = (providers: EnabledProviders) =>
  providers.github || providers.google;

/** Only providers configured on the server get a button. */
export function SocialSignIn({
  providers,
  callbackURL = "/",
  errorCallbackURL,
  disabled,
  onError,
}: {
  providers: EnabledProviders;
  /** Where the user lands after signing in. */
  callbackURL?: string;
  /** Where better-auth sends the user back with `?error=` if OAuth fails. */
  errorCallbackURL: string;
  disabled: boolean;
  onError: (message: string) => void;
}) {
  const t = useTranslations("auth");
  const [pending, setPending] = useState<Provider | null>(null);

  const start = async (provider: Provider) => {
    setPending(provider);
    try {
      const { error } = await authClient.signIn.social({
        provider,
        callbackURL,
        errorCallbackURL,
      });
      if (!error) return;
      onError(
        error.status === 429 ? t("errors.tooManyAttempts") : t("errors.oauth"),
      );
    } catch {
      onError(t("errors.network"));
    }
    setPending(null);
  };

  const blocked = disabled || pending !== null;
  if (!hasSocialSignIn(providers)) return null;
  return (
    <div className="flex flex-col gap-2">
      {providers.github ? (
        <Button
          size="lg"
          className="w-full"
          disabled={blocked && pending !== "github"}
          loading={pending === "github"}
          onClick={() => start("github")}
        >
          {pending === "github" ? null : <GitHubIcon />}
          {t("continueWithGithub")}
        </Button>
      ) : null}
      {providers.google ? (
        <Button
          size="lg"
          className="w-full"
          disabled={blocked && pending !== "google"}
          loading={pending === "google"}
          onClick={() => start("google")}
        >
          {pending === "google" ? null : <GoogleIcon />}
          {t("continueWithGoogle")}
        </Button>
      ) : null}
    </div>
  );
}
