"use client";
import { useRouter } from "@/i18n/navigation";
import { Button } from "../ui/button";
import { Loader2Icon, MailWarning } from "lucide-react";
import { sendVerificationEmail } from "@/app/actions/userActions";
import { useState } from "react";
import { useLocale } from "next-intl";

export const VerificationError = ({ email }: { email: string }) => {
  const locale = useLocale();
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  return (
    <div className="flex flex-col items-start max-w-sm mx-auto gap-4 text-center">
      <MailWarning className="text-red-600 w-12 h-12 mx-auto" />
      <h1 className="lg:text-2xl md:text-lg sm:text-base text-sm font-bold text-left">
        Verification Link Expired
      </h1>
      <h2 className="lg:text-base sm:text-sm text-xs font-normal text-left">
        Looks like the email verification link has expired. No worries we can
        send you another one.
      </h2>
      <Button
        onClick={async () => {
          setLoading(true);
          const token = await sendVerificationEmail(email, locale);
          router.push(`/verification-sent/${token}`);
        }}
        disabled={loading}
        className="w-full"
      >
        {loading ? (
          <>
            Sending... <Loader2Icon className="animate-spin" />
          </>
        ) : (
          <>Resend Verification Link.</>
        )}
      </Button>
    </div>
  );
};
