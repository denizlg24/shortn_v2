import { VerificationSentComponent } from "@/components/register/verification-sent";
import { connectDB } from "@/lib/mongodb";
import { VerificationToken } from "@/models/auth/Token";
import { User } from "@/models/auth/User";
import env from "@/utils/env";
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
  const foundVerificationToken = await VerificationToken.findOne({
    token: `${token}${env.EMAIL_TOKEN_SUFFIX}`,
  }).lean();
  if (!foundVerificationToken) {
    notFound();
  }
  const user = await User.findOne({
    _id: foundVerificationToken._userId,
  }).lean();
  if (!user) {
    notFound();
  }
  return (
    <main className="flex flex-col items-center w-full mx-auto md:gap-0 gap-2 mb-16">
      <div className="w-full flex flex-col max-w-lg p-4 gap-6 sm:pt-8">
        <VerificationSentComponent email={user.email} />
      </div>
    </main>
  );
}
