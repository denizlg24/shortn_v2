import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { connectDB } from "@/lib/mongodb";
import { ResetToken } from "@/models/auth/ResetToken";
import { User } from "@/models/auth/User";
import env from "@/utils/env";
import { LogIn, MailCheck } from "lucide-react";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";

export default async function Home({
  params,
}: {
  params: Promise<{ locale: string; token: string }>;
}) {
  const { locale, token } = await params;
  setRequestLocale(locale);
  await connectDB();
  const foundResetToken = await ResetToken.findOne({
    token: `${token}${env.EMAIL_TOKEN_SUFFIX}`,
  }).lean();
  if (!foundResetToken) {
    notFound();
  }
  const user = await User.findOne({ sub: foundResetToken.sub }).lean();
  if (!user) {
    notFound();
  }

  return (
    <main className="flex flex-col items-center w-full mx-auto md:gap-0 gap-2 mb-16">
      <div className="w-full flex flex-col max-w-lg p-4 gap-6 sm:pt-8">
        <div className="flex flex-col items-start max-w-sm mx-auto gap-4 text-center">
          <MailCheck className="text-green-600 w-12 h-12 mx-auto" />
          <h1 className="lg:text-2xl md:text-lg sm:text-base text-sm font-bold text-left">
            We&apos;ve sent you an email!
          </h1>
          <h2 className="lg:text-base sm:text-sm text-xs font-normal text-left">
            Check your inbox <span className="font-semibold">{user.email}</span>{" "}
            and get a link to reset your password.
          </h2>
          <Button asChild className="w-full">
            <Link href="/login">
              Login <LogIn />
            </Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
