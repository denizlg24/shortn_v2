import { connectDB } from "@/lib/mongodb";
import UrlV3 from "@/models/url/UrlV3";
import { setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import { PasswordVerificationForm } from "./password-verification-form";
import Link from "next/link";
import { Lock } from "lucide-react";

export default async function AuthenticateLinkPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);

  await connectDB();
  const urlDoc = await UrlV3.findOne({ urlCode: slug })
    .select("-passwordHash")
    .lean();

  if (!urlDoc) {
    redirect("/");
  }

  if (!urlDoc.passwordProtected) {
    redirect(`/${slug}`);
  }

  return (
    <div className="flex justify-center p-4 w-full">
      <div className="w-full max-w-md sm:mt-12 mt-6">
        <div className="bg-background rounded-lg shadow-xl p-8 space-y-6 border">
          <div className="flex flex-col items-center text-center space-y-4">
            <div className="w-16 h-16 bg-secondary rounded-full flex items-center justify-center">
              <Lock className="w-8 h-8 text-secondary-foreground" />
            </div>
            <div className="space-y-2">
              <h1 className="text-2xl font-bold text-foreground">
                Password Protected Link
              </h1>
              {urlDoc.title && (
                <p className="text-sm text-muted-foreground">{urlDoc.title}</p>
              )}
              <p className="text-sm text-muted-foreground">
                This link requires a password to access
              </p>
            </div>
          </div>

          {urlDoc.passwordHint && (
            <div className="bg-secondary border rounded-lg p-4">
              <p className="text-sm text-secondary-foreground">
                <span className="font-semibold">Hint:</span>{" "}
                {urlDoc.passwordHint}
              </p>
            </div>
          )}

          <PasswordVerificationForm slug={slug} />

          <div className="text-center pt-4 border-t">
            <p className="text-xs text-muted-foreground">
              Protected by{" "}
              <Link href="/" className="hover:underline">
                Shortn
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
