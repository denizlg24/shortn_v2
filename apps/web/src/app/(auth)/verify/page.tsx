import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { cookies } from "next/headers";
import { isEmail } from "@/components/auth/rules";
import { verifyEmailCookie } from "@/components/auth/verify-email-cookie";
import { VerifyPanel, type VerifyState } from "./verify-panel";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth.verify");
  return { title: t("metaTitle") };
}

// A verified link signs the user in and redirects here; the (auth) layout then
// forwards them to their workspace. Failures arrive as `?error=<code>`.
function stateFrom(
  error: string | string[] | undefined,
  reason: string | string[] | undefined,
): VerifyState {
  if (error === "token_expired") return "expired";
  if (error) return "invalid";
  return reason === "unverified" ? "unverified" : "sent";
}

export default async function VerifyPage({
  searchParams,
}: PageProps<"/verify">) {
  const { error, reason } = await searchParams;
  const stored = (await cookies()).get(verifyEmailCookie)?.value;
  return (
    <VerifyPanel
      state={stateFrom(error, reason)}
      email={stored && isEmail(stored) ? stored : null}
    />
  );
}
