import { safeNext } from "@shortn/auth";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { parseOAuthFailure } from "@/components/auth/oauth-failure";
import { socialProviders } from "@/server/auth";
import { LoginForm } from "./login-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth.login");
  return { title: t("metaTitle") };
}

// `next` brings the user back after signing in (e.g. an invite link); only
// same-app relative paths pass, so it can't become an open redirect.
export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { error, next } = await searchParams;
  return (
    <LoginForm
      oauthFailure={parseOAuthFailure(error)}
      providers={socialProviders()}
      next={safeNext(typeof next === "string" ? next : undefined)}
    />
  );
}
