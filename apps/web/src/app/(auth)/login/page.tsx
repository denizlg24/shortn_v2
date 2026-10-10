import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { parseOAuthFailure } from "@/components/auth/oauth-failure";
import { LoginForm } from "./login-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth.login");
  return { title: t("metaTitle") };
}

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { error } = await searchParams;
  return <LoginForm oauthFailure={parseOAuthFailure(error)} />;
}
