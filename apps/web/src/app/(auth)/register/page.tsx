import { safeNext } from "@shortn/auth";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { parseOAuthFailure } from "@/components/auth/oauth-failure";
import { socialProviders } from "@/server/auth";
import { leaveIfSignedIn } from "@/server/auth-redirect";
import { RegisterForm } from "./register-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth.register");
  return { title: t("metaTitle") };
}

export default async function RegisterPage({
  searchParams,
}: PageProps<"/register">) {
  const { error, next } = await searchParams;
  await leaveIfSignedIn(next);
  return (
    <RegisterForm
      oauthFailure={parseOAuthFailure(error)}
      providers={socialProviders()}
      next={safeNext(typeof next === "string" ? next : undefined)}
    />
  );
}
