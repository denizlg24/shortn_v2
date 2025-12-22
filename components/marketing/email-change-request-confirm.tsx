"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useRouter } from "@/i18n/navigation";
import { authClient } from "@/lib/authClient";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { CheckCircle2, XCircle, Mail, AlertTriangle } from "lucide-react";

type Status =
  | { kind: "idle" }
  | { kind: "verifying" }
  | { kind: "success" }
  | { kind: "failed"; message: string };

export const EmailChangeRequestConfirm = () => {
  const searchParams = useSearchParams();
  const router = useRouter();

  const token = searchParams.get("token");
  const oldEmail = searchParams.get("email");
  const newEmail = searchParams.get("new");

  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [redirectIn, setRedirectIn] = useState<number | null>(null);

  const effectiveStatus: Status =
    !token || !oldEmail || !newEmail
      ? {
          kind: "failed",
          message: "This email change link is missing required information.",
        }
      : status;

  const handleConfirm = async () => {
    if (!token) return;

    setStatus({ kind: "verifying" });

    try {
      const { error } = await authClient.verifyEmail({
        query: { token },
      });

      if (error) {
        setStatus({
          kind: "failed",
          message: "This verification link is invalid or has expired.",
        });
        return;
      }

      setStatus({ kind: "success" });
      setRedirectIn(5);
    } catch {
      setStatus({
        kind: "failed",
        message:
          "We couldn't process your request right now. Please try again.",
      });
    }
  };

  useEffect(() => {
    if (redirectIn == null) return;
    if (redirectIn <= 0) {
      router.replace("/login");
      return;
    }

    const t = window.setTimeout(() => {
      setRedirectIn((s) => (s == null ? s : Math.max(0, s - 1)));
    }, 1000);

    return () => window.clearTimeout(t);
  }, [redirectIn, router]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="space-y-6"
    >
      <AnimatePresence mode="wait">
        {effectiveStatus.kind === "idle" && (
          <motion.div
            key="idle"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="space-y-4"
          >
            <motion.div
              className="flex justify-center"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.4, delay: 0.1 }}
            >
              <div className="rounded-full bg-amber-500/10 p-4">
                <AlertTriangle className="h-8 w-8 text-amber-600" />
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.2 }}
            >
              <h2 className="text-2xl font-semibold text-center mb-2">
                Confirm Email Change
              </h2>
              <p className="text-sm text-muted-foreground text-center">
                Please review and confirm this email address change.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.3 }}
            >
              <Alert>
                <Mail className="h-4 w-4" />
                <AlertTitle>Email Address Change</AlertTitle>
                <AlertDescription className="space-y-2">
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">From:</p>
                    <p className="font-medium">{oldEmail}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">To:</p>
                    <p className="font-medium">{newEmail}</p>
                  </div>
                </AlertDescription>
              </Alert>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.4 }}
              className="rounded-lg border bg-card p-4"
            >
              <h3 className="font-medium text-sm mb-2">What happens next?</h3>
              <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
                <li>Click confirm to proceed with the email change</li>
                <li>
                  We&apos;ll send a verification email to your new address
                </li>
                <li>Verify your new email to complete the change</li>
              </ol>
            </motion.div>
          </motion.div>
        )}

        {effectiveStatus.kind === "verifying" && (
          <motion.div
            key="verifying"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="space-y-4"
          >
            <motion.div
              className="flex justify-center"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.4, delay: 0.1 }}
            >
              <div className="rounded-full bg-primary/10 p-4">
                <Spinner className="h-8 w-8" />
              </div>
            </motion.div>

            <p className="text-sm text-muted-foreground text-center">
              Please wait while we process your email change request.
            </p>

            <div className="rounded-lg border bg-card px-4 py-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Spinner />
                <span>Processing email change…</span>
              </div>
              <div className="mt-2 h-1 w-full overflow-hidden rounded bg-muted">
                <motion.div
                  className="h-full w-1/2 rounded bg-primary"
                  initial={{ x: "-100%" }}
                  animate={{ x: "200%" }}
                  transition={{
                    duration: 1.1,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                />
              </div>
            </div>
          </motion.div>
        )}

        {effectiveStatus.kind === "success" && (
          <motion.div
            key="success"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="space-y-4"
          >
            <motion.div
              className="flex justify-center"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.4, delay: 0.1 }}
            >
              <div className="rounded-full bg-green-500/10 p-4">
                <CheckCircle2 className="h-8 w-8 text-green-600" />
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.2 }}
            >
              <h2 className="text-2xl font-semibold text-center mb-2">
                Email Change Confirmed!
              </h2>
              <p className="text-sm text-muted-foreground text-center">
                Your email address has been updated.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.3 }}
            >
              <Alert>
                <Mail className="h-4 w-4" />
                <AlertTitle>Verify Your New Email</AlertTitle>
                <AlertDescription className="space-y-2">
                  <p>
                    We&apos;ve sent a verification email to{" "}
                    <strong>{newEmail}</strong>. Please check your inbox and
                    click the verification link to complete the process.
                  </p>
                  <p className="text-xs">
                    Don&apos;t forget to check your spam folder if you
                    don&apos;t see it.
                  </p>
                </AlertDescription>
              </Alert>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.4 }}
            >
              <Alert>
                <CheckCircle2 className="h-4 w-4" />
                <AlertTitle>Redirecting to Login</AlertTitle>
                <AlertDescription>
                  {redirectIn != null ? (
                    <>Redirecting you to login in {redirectIn} seconds…</>
                  ) : (
                    "Redirecting you to login…"
                  )}
                </AlertDescription>
              </Alert>
            </motion.div>

            {redirectIn != null && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3, delay: 0.5 }}
                className="h-2 w-full overflow-hidden rounded bg-muted"
              >
                <motion.div
                  className="h-full rounded bg-green-600"
                  initial={{ width: "0%" }}
                  animate={{ width: "100%" }}
                  transition={{ duration: 5, ease: "linear" }}
                />
              </motion.div>
            )}
          </motion.div>
        )}

        {effectiveStatus.kind === "failed" && (
          <motion.div
            key="failed"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="space-y-4"
          >
            <motion.div
              className="flex justify-center"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.4, delay: 0.1 }}
            >
              <div className="rounded-full bg-red-500/10 p-4">
                <XCircle className="h-8 w-8 text-red-600" />
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.2 }}
            >
              <h2 className="text-2xl font-semibold text-center mb-2">
                Change Request Failed
              </h2>
              <p className="text-sm text-muted-foreground text-center">
                We couldn&apos;t process your email change request.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.3 }}
            >
              <Alert variant="destructive">
                <XCircle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{effectiveStatus.message}</AlertDescription>
              </Alert>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.4 }}
              className="rounded-lg border bg-card p-4"
            >
              <h3 className="font-medium text-sm mb-2">What can you do?</h3>
              <ul className="text-sm text-muted-foreground space-y-2 list-disc list-inside">
                <li>
                  Request a new email change link from your account settings
                </li>
                <li>Make sure you&apos;re using the latest link sent to you</li>
                <li>Contact support if the issue persists</li>
              </ul>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3, delay: 0.5 }}
        className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2"
      >
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push("/login")}
          className="w-full sm:w-auto"
        >
          Back to Login
        </Button>

        {effectiveStatus.kind === "idle" && (
          <Button
            type="button"
            onClick={handleConfirm}
            className="w-full sm:w-auto"
          >
            Confirm Email Change
          </Button>
        )}
      </motion.div>

      {effectiveStatus.kind === "idle" && (
        <p className="text-center text-xs text-muted-foreground pt-4">
          Only confirm if you requested this email change.
        </p>
      )}
    </motion.div>
  );
};
