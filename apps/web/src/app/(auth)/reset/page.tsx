import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ResetForm } from "./reset-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth.reset");
  return { title: t("metaTitle") };
}

// better-auth redirects here with `?token=` from the email link, or with
// `?error=INVALID_TOKEN` when the link is expired or already used.
export default async function ResetPage({ searchParams }: PageProps<"/reset">) {
  const { token, error } = await searchParams;
  const usable = typeof token === "string" && token.length > 0 && !error;
  return <ResetForm token={usable ? token : null} />;
}
