"use client";

import { Loader2, LogIn, MailCheck } from "lucide-react";
import { Button } from "../ui/button";
import { Link } from "@/i18n/navigation";
import { useEffect, useState } from "react";
import { sendVerificationEmail } from "@/app/actions/userActions";
import { useLocale } from "next-intl";

export const VerificationSentComponent = ({ email }: { email: string }) => {
  const locale = useLocale();
  const [cooldown, setCooldown] = useState(0);
  const [resending, setResending] = useState(false);
  useEffect(() => {
    if (cooldown === 0) return;

    const interval = setInterval(() => {
      setCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [cooldown]);

  const formatTime = (seconds: number) => {
    const min = Math.floor(seconds / 60);
    const sec = seconds % 60;
    return `${min}:${sec.toString().padStart(2, "0")}`;
  };
  return (
    <div className="flex flex-col items-start max-w-sm mx-auto gap-4 text-center">
      <MailCheck className="text-green-600 w-12 h-12 mx-auto" />
      <h1 className="lg:text-2xl md:text-lg sm:text-base text-sm font-bold text-left">
        We&apos;ve sent you an email!
      </h1>
      <h2 className="lg:text-base sm:text-sm text-xs font-normal text-left">
        Check your inbox{" "}
        <span className="font-semibold">{decodeURIComponent(email)}</span> and
        get your account verified to use shortn.
      </h2>
      <div className="w-full flex flex-row items-end justify-start gap-1 ">
        <p className="text-sm align-text-bottom">
          Didn&apos;t receive an email?
        </p>
        <Button
          type="button"
          onClick={async () => {
            setResending(true);
            const token = await sendVerificationEmail(
              decodeURIComponent(email),
              locale,
            );
            if (!token) {
              console.log("Error sending verification email");
            }
            setCooldown(300);
            setResending(false);
          }}
          disabled={cooldown > 0 || resending}
          variant="link"
          className="p-0 h-fit text-sm"
        >
          {resending ? (
            <>
              <Loader2 className="animate-spin" /> Sending...
            </>
          ) : cooldown > 0 ? (
            `Resend in ${formatTime(cooldown)}`
          ) : (
            "Resend."
          )}
        </Button>
      </div>
      <Button asChild className="w-full">
        <Link href="/login">
          Login <LogIn />
        </Link>
      </Button>
    </div>
  );
};
