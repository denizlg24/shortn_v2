import { Link } from "@/i18n/navigation";
import { Button } from "../ui/button";
import { LogIn, MailCheck } from "lucide-react";

export const VerificationSuccess = ({ email }: { email: string }) => {
  return (
    <div className="flex flex-col items-center max-w-sm mx-auto gap-4 text-center">
      <MailCheck className="text-green-600 w-12 h-12 mx-auto" />
      <h1 className="lg:text-2xl md:text-lg sm:text-base text-sm font-bold">
        Account Verified
      </h1>
      <h2 className="lg:text-base sm:text-sm text-xs font-normal">
        Congratulations your email{" "}
        <span className="font-semibold">{email}</span> account has been
        verified.
      </h2>
      <Button asChild className="w-full">
        <Link href="/login">
          Login <LogIn />
        </Link>
      </Button>
    </div>
  );
};
