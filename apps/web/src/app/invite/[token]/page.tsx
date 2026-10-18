import { findInvite } from "@shortn/core";
import { physicalNames } from "@shortn/db";
import { buttonVariants, cn } from "@shortn/ui";
import { ObjectId } from "mongodb";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthFrame } from "@/components/auth/auth-frame";
import { AuthHeading } from "@/components/auth/auth-parts";
import { AcceptInvite } from "@/components/invite/accept-invite";
import { SwitchAccount } from "@/components/invite/switch-account";
import { getSession } from "@/server/auth";
import { db } from "@/server/db";
import { strong } from "@/lib/rich-text";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("invite");
  return { title: t("metaTitle") };
}

const tokenPattern = /^[\w-]{16,128}$/;

async function inviterName(userId: string) {
  if (!ObjectId.isValid(userId)) return null;
  const user = await (
    await db()
  )
    .collection(physicalNames.user)
    .findOne(
      { _id: new ObjectId(userId) },
      { projection: { name: 1, email: 1 } },
    );
  const name: unknown = user?.name || user?.email;
  return typeof name === "string" && name ? name : null;
}

export default async function InvitePage({
  params,
}: PageProps<"/invite/[token]">) {
  const { token } = await params;
  const t = await getTranslations("invite");
  const found = tokenPattern.test(token)
    ? await findInvite(await db(), token)
    : null;

  if (!found)
    return (
      <AuthFrame>
        <AuthHeading
          title={t("invalid.title")}
          description={t("invalid.body")}
        />
        <Link href="/" className={cn(buttonVariants({ size: "lg" }), "w-full")}>
          {t("goHome")}
        </Link>
      </AuthFrame>
    );

  const session = await getSession();
  const next = `/invite/${token}`;
  if (!session) redirect(`/login?next=${encodeURIComponent(next)}`);

  const { invite, workspace } = found;
  if (session.user.email.trim().toLowerCase() !== invite.email)
    return (
      <AuthFrame>
        <AuthHeading
          title={t("mismatch.title")}
          description={t.rich("mismatch.body", {
            invited: invite.email,
            email: session.user.email,
            strong,
          })}
        />
        <div className="flex flex-col gap-2">
          <SwitchAccount next={next} />
          <Link
            href="/"
            className={cn(
              buttonVariants({ size: "lg", variant: "ghost" }),
              "w-full",
            )}
          >
            {t("goHome")}
          </Link>
        </div>
      </AuthFrame>
    );

  const inviter = await inviterName(invite.invitedBy);
  const role = t(`roleAs.${invite.role}`);
  return (
    <AuthFrame>
      <AuthHeading
        title={t("title", { workspace: workspace.name })}
        description={
          inviter
            ? t.rich("body", { inviter, role, strong })
            : t("bodyNoInviter", { role })
        }
      />
      <AcceptInvite token={token} />
      <p className="mt-4 text-center text-meta text-fg-subtle">
        {t("signedInAs", { email: session.user.email })}
      </p>
    </AuthFrame>
  );
}
