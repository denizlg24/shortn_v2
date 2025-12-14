"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { authClient } from "@/lib/authClient";
import { Mail } from "lucide-react";
import { useLocale } from "next-intl";
import { BASEURL } from "@/lib/utils";
import { toast } from "sonner";

type Status =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "success"; message: string }
  | { kind: "error"; message: string };

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function VerifySentCard({ initialEmail }: { initialEmail?: string }) {
  const [email, setEmail] = React.useState(initialEmail ?? "");
  const [status, setStatus] = React.useState<Status>({ kind: "idle" });
  const [cooldownLeft, setCooldownLeft] = React.useState(0);
  const locale = useLocale();

  React.useEffect(() => {
    if (cooldownLeft <= 0) return;
    const t = window.setInterval(() => {
      setCooldownLeft((s) => Math.max(0, s - 1));
    }, 1000);

    return () => window.clearInterval(t);
  }, [cooldownLeft]);

  const canSubmit = email.trim().length > 0 && isValidEmail(email);

  const onResend = async () => {
    if (!canSubmit) {
      toast.error("Please provide a valid email address.");
      return;
    }

    if (cooldownLeft > 0) {
      setStatus({
        kind: "error",
        message: `Please wait ${cooldownLeft > 60 ? `${Math.floor(cooldownLeft / 60)}:${cooldownLeft % 60}` : cooldownLeft}s before resending.`,
      });
      return;
    }

    setStatus({ kind: "loading" });

    try {
      const { error } = await authClient.sendVerificationEmail({
        email,
        callbackURL: `${BASEURL}/${locale}/dashboard`,
      });

      if (error) {
        toast.error("Something went wrong while sending your email.");
        return;
      }
      toast.success("Verification email sent. Check your inbox (and spam).");
      setStatus({ kind: "idle" });
      setCooldownLeft(60 * 5);
    } catch {
      toast.error("Something went wrong while sending your email.");
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="space-y-6"
    >
      {/* Email icon visual */}
      <motion.div
        className="flex justify-center"
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.4, delay: 0.1 }}
      >
        <div className="rounded-full bg-primary/10 p-4">
          <Mail className="h-8 w-8 text-primary" />
        </div>
      </motion.div>

      <div className="space-y-4">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.2 }}
        >
          <Alert>
            <Mail className="h-4 w-4" />
            <AlertTitle>Check Your Inbox</AlertTitle>
            <AlertDescription className="space-y-2">
              <p>
                We&apos;ve sent a verification link to your email address. Click
                the link to verify your account.
              </p>
              <p className="text-xs">
                If you don&apos;t see the email, check your spam or junk folder.
              </p>
            </AlertDescription>
          </Alert>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.3 }}
          className="space-y-3"
        >
          <Label htmlFor="verify-email" className="text-sm">
            Need to resend? Enter your email
          </Label>
          <Input
            id="verify-email"
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="you@company.com"
            value={email}
            disabled={cooldownLeft > 0}
            onChange={(e) => {
              setEmail(e.target.value);
              if (status.kind !== "idle") {
                setStatus({ kind: "idle" });
              }
            }}
          />
          <AnimatePresence>
            {cooldownLeft > 0 && (
              <motion.p
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                className="text-muted-foreground text-xs"
              >
                You can resend in{" "}
                {cooldownLeft > 60
                  ? `${Math.floor(cooldownLeft / 60)}:${cooldownLeft % 60}`
                  : cooldownLeft}{" "}
                seconds
              </motion.p>
            )}
          </AnimatePresence>
        </motion.div>

        <AnimatePresence mode="wait">
          {status.kind === "loading" && (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="space-y-4"
            >
              <div className="rounded-lg border bg-card px-4 py-3">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Spinner />
                  <span>Sending verification email…</span>
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

          {status.kind === "success" && (
            <motion.div
              key="success"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <Alert>
                <AlertTitle>Sent</AlertTitle>
                <AlertDescription>{status.message}</AlertDescription>
              </Alert>
            </motion.div>
          )}

          {status.kind === "error" && (
            <motion.div
              key="error"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <Alert variant="destructive">
                <AlertTitle>Couldn&apos;t send</AlertTitle>
                <AlertDescription>{status.message}</AlertDescription>
              </Alert>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3, delay: 0.4 }}
        className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2"
      >
        <Button
          type="button"
          variant="outline"
          onClick={() => window.location.assign("/login")}
          className="w-full sm:w-auto"
        >
          Back to Login
        </Button>

        <Button
          type="button"
          onClick={onResend}
          disabled={!canSubmit || status.kind === "loading" || cooldownLeft > 0}
          className="w-full sm:w-auto"
        >
          {status.kind === "loading" ? (
            <>
              <Spinner className="mr-2" />
              Sending…
            </>
          ) : (
            "Resend Email"
          )}
        </Button>
      </motion.div>

      <p className="text-center text-xs text-muted-foreground pt-4">
        For your security, we won&apos;t tell you whether an email exists.
      </p>
    </motion.div>
  );
}
