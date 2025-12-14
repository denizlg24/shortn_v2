import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { VerifySentCard } from "@/components/marketing/verify-sent-card";

export default async function EmailSentPage() {
  const cookieStore = await cookies();
  const hasFlowCookie = cookieStore.has("flow_signup_success");
  const email = cookieStore.get("flow_signup_email")?.value;

  if (!hasFlowCookie) {
    redirect("/register");
  }

  return (
    <main className="flex flex-col items-center w-full mx-auto md:gap-0 gap-2 mb-16">
      <div className="w-full flex flex-col max-w-lg p-4 gap-6 sm:pt-8">
        <div className="flex flex-col gap-0 w-full">
          <h1 className="lg:text-3xl md:text-2xl sm:text-xl text-lg font-bold">
            Check your inbox
          </h1>
          <h2 className="lg:text-lg md:text-base text-sm">
            We&apos;ve sent a verification link to your email.
          </h2>
        </div>

        <VerifySentCard initialEmail={email} />
      </div>
    </main>
  );
}
