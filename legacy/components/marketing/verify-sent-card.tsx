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
import { useLocale, useTranslations } from "next-intl";
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
  const t = useTranslations("verify.sent");
  const tVerify = useTranslations("verify");
  const [email, setEmail] = React.useState(initialEmail ?? "");
  const [status, setStatus] = React.useState<Status>({ kind: "idle" });
  const [cooldownLeft, setCooldownLeft] = React.useState(0);
  const locale = useLocale();

  React.useEffect(() => {
    if (cooldownLeft <= 0) return;
    const timer = window.setInterval(() => {
      setCooldownLeft((s) => Math.max(0, s - 1));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [cooldownLeft]);

  const canSubmit = email.trim().length > 0 && isValidEmail(email);

  const onResend = async () => {
    if (!canSubmit) {
      toast.error(t("toast-invalid-email"));
      return;
    }

    if (cooldownLeft > 0) {
      setStatus({
        kind: "error",
        message: t("resend-cooldown", {
          time:
            cooldownLeft > 60
              ? `${Math.floor(cooldownLeft / 60)}:${cooldownLeft % 60}`
              : cooldownLeft,
        }),
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
        toast.error(t("toast-error"));
        return;
      }
      toast.success(t("toast-success"));
      setStatus({ kind: "idle" });
      setCooldownLeft(60 * 5);
    } catch {
      toast.error(t("toast-error"));
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="space-y-6"
    >
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
            <AlertTitle>{t("check-inbox-title")}</AlertTitle>
            <AlertDescription className="space-y-2">
              <p>{t("link-sent-description")}</p>
              <p className="text-xs">{t("check-spam")}</p>
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
            {t("resend-label")}
          </Label>
          <Input
            id="verify-email"
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder={t("placeholder-email")}
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
                {t("resend-cooldown", {
                  time:
                    cooldownLeft > 60
                      ? `${Math.floor(cooldownLeft / 60)}:${cooldownLeft % 60}`
                      : cooldownLeft,
                })}
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
                  <span>{t("sending-email")}</span>
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
                <AlertTitle>{t("alert-sent")}</AlertTitle>
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
                <AlertTitle>{t("alert-could-not-send")}</AlertTitle>
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
          {tVerify("back-to-login")}
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
              {t("sending-button")}
            </>
          ) : (
            t("resend-button")
          )}
        </Button>
      </motion.div>

      <p className="text-center text-xs text-muted-foreground pt-4">
        {t("security-note")}
      </p>
    </motion.div>
  );
}
