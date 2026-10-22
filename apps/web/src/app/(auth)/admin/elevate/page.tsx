import { adminElevationRefusal } from "@shortn/core";
import { accountFlagsProjection, collection } from "@shortn/db";
import { ObjectId } from "mongodb";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { notFound, redirect } from "next/navigation";
import { AdminElevateForm } from "@/components/auth/admin-elevate-form";
import { AuthHeading, FormAlert } from "@/components/auth/auth-parts";
import { getSession } from "@/server/auth";
import { db } from "@/server/db";
import { env } from "@/server/env";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth.adminElevate");
  return { title: t("metaTitle"), robots: { index: false, follow: false } };
}

// The admin console sends staff here with the sha256 of a nonce it holds in
// a cookie (23 §1.1); the code entered here is exchanged for a token bound
// to that nonce. The API endpoint re-checks everything this page checks.
export default async function AdminElevatePage({
  searchParams,
}: PageProps<"/admin/elevate">) {
  if (!env().ADMIN_ORIGIN) notFound();
  const { n, purpose } = await searchParams;
  if (
    typeof n !== "string" ||
    !/^[a-f\d]{64}$/.test(n) ||
    (purpose !== "login" && purpose !== "stepup")
  )
    notFound();
  const session = await getSession();
  if (!session)
    redirect(
      `/login?next=${encodeURIComponent(`/admin/elevate?n=${n}&purpose=${purpose}`)}`,
    );
  const t = await getTranslations("auth.adminElevate");
  const user = /^[a-f\d]{24}$/i.test(session.user.id)
    ? await collection(await db(), "user").findOne(
        { _id: new ObjectId(session.user.id) },
        {
          projection: {
            ...accountFlagsProjection,
            role: 1,
            emailVerified: 1,
            twoFactorEnabled: 1,
          },
        },
      )
    : null;
  const refusal = session.session.impersonatedBy
    ? "impersonating"
    : user
      ? adminElevationRefusal(user)
      : "not_staff";
  if (refusal)
    return (
      <>
        <AuthHeading title={t("unavailableTitle")} />
        <FormAlert>{t(`refusals.${refusal}`)}</FormAlert>
      </>
    );
  return <AdminElevateForm nonceHash={n} purpose={purpose} />;
}
