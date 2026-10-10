import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { parseOAuthFailure } from "@/components/auth/oauth-failure";
import { RegisterForm } from "./register-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth.register");
  return { title: t("metaTitle") };
}

export default async function RegisterPage({
  searchParams,
}: PageProps<"/register">) {
  const { error } = await searchParams;
  return <RegisterForm oauthFailure={parseOAuthFailure(error)} />;
}
