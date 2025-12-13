"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useRouter } from "@/i18n/navigation";
import { authClient } from "@/lib/authClient";

type Status =
  | { kind: "verifying" }
  | { kind: "success" }
  | { kind: "failed"; message: string };

export const VerifiedPage = () => {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token");

  const [status, setStatus] = useState<Status>({ kind: "verifying" });
  const [redirectIn, setRedirectIn] = useState<number | null>(null);

  // If token is missing, treat it as a derived failure state.
  const effectiveStatus: Status =
    token === null
      ? {
          kind: "failed",
          message: "This verification link is missing a token.",
        }
      : status;

  useEffect(() => {
    if (!token) return;

    let cancelled = false;

    authClient
      .verifyEmail({
        query: {
          token,
        },
      })
      .then(({ error }) => {
        if (cancelled) return;

        if (error) {
          setStatus({
            kind: "failed",
            message: "This verification link is invalid or has expired.",
          });
          return;
        }

        setStatus({ kind: "success" });
        setRedirectIn(3);
      })
      .catch(() => {
        if (cancelled) return;
        setStatus({
          kind: "failed",
          message: "We couldn't verify your email right now. Please try again.",
        });
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  useEffect(() => {
    if (redirectIn == null) return;
    if (redirectIn <= 0) {
      router.replace("/dashboard");
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
        {effectiveStatus.kind === "verifying" && (
          <motion.div
            key="verifying"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="space-y-4"
          >
            {/* Spinner icon visual */}
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
              Please wait while we verify your email address.
            </p>

            <div className="rounded-lg border bg-card px-4 py-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Spinner />
                <span>Verifying your email…</span>
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
            {/* Success icon visual */}
            <motion.div
              className="flex justify-center"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.4, delay: 0.1 }}
            >
              <div className="rounded-full bg-primary/10 p-4">
                <svg
                  className="h-8 w-8 text-primary"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
            </motion.div>

            <Alert>
              <AlertTitle>Email verified!</AlertTitle>
              <AlertDescription>
                Your email has been verified successfully.
                {redirectIn != null ? (
                  <> Redirecting to your dashboard in {redirectIn}s…</>
                ) : (
                  " Redirecting you to your dashboard…"
                )}
              </AlertDescription>
            </Alert>

            {redirectIn != null && (
              <div className="h-2 w-full overflow-hidden rounded bg-muted">
                <motion.div
                  className="h-full rounded bg-primary"
                  initial={{ width: "0%" }}
                  animate={{ width: "100%" }}
                  transition={{ duration: 3, ease: "linear" }}
                />
              </div>
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
            {/* Error icon visual */}
            <motion.div
              className="flex justify-center"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.4, delay: 0.1 }}
            >
              <div className="rounded-full bg-muted p-4">
                <svg
                  className="h-8 w-8 text-muted-foreground"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </div>
            </motion.div>

            <Alert variant="destructive">
              <AlertTitle>Verification failed</AlertTitle>
              <AlertDescription>{effectiveStatus.message}</AlertDescription>
            </Alert>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
        <Button
          type="button"
          variant="ghost"
          onClick={() => router.push("/login")}
          className="w-full sm:w-auto"
        >
          Back to login
        </Button>

        {effectiveStatus.kind === "failed" && (
          <Button
            type="button"
            onClick={() => router.push("/register")}
            className="w-full sm:w-auto"
          >
            Create account
          </Button>
        )}
      </div>
    </motion.div>
  );
};
